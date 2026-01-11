/**
 * 🛤️ THE SPATIAL ROUTER — PROJECT LOCK ENFORCEMENT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Core routing with Project Lock middleware.
 * Blocks navigation outside Diamond Arena until 100% built.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
    type ReactNode
} from 'react';
import { useArena } from './arena-auth-context';

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type ArenaRoute =
    | '/login'
    | '/loading'
    | '/forbidden'
    | '/app'
    | '/app/arena'
    | '/app/leaderboard'
    | '/app/history'
    | '/app/profile'
    | '/app/settings';

export type ProjectStatus = 'LOCKED' | 'BUILDING' | 'COMPLETE' | 'MAINTENANCE';

export interface BuildProgress {
    project: string;
    percentage: number;
    status: ProjectStatus;
    currentPhase: string;
    blockedRoutes: string[];
    allowedRoutes: ArenaRoute[];
}

export interface RouterState {
    currentRoute: ArenaRoute;
    previousRoute: ArenaRoute | null;
    isTransitioning: boolean;
    isLocked: boolean;
    buildProgress: BuildProgress;
    canNavigate: (route: ArenaRoute) => boolean;
    navigate: (route: ArenaRoute) => Promise<boolean>;
    goBack: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ ROUTER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const ROUTER_CONFIG = {
    // Project Lock threshold
    UNLOCK_THRESHOLD: 100,

    // Default routes (always accessible)
    PUBLIC_ROUTES: ['/login', '/loading', '/forbidden'] as ArenaRoute[],

    // Protected routes (require auth)
    PROTECTED_ROUTES: ['/app', '/app/arena', '/app/leaderboard', '/app/history', '/app/profile', '/app/settings'] as ArenaRoute[],

    // Transition duration (ms)
    TRANSITION_DURATION: 600,

    // Project identifier
    PROJECT_ID: 'DIAMOND_ARENA',
};

// ═══════════════════════════════════════════════════════════════════════════
// 🌌 ROUTER CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const RouterContext = createContext<RouterState | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 ARENA ROUTER PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

interface ArenaRouterProviderProps {
    children: ReactNode;
    initialRoute?: ArenaRoute;
}

export const ArenaRouterProvider: React.FC<ArenaRouterProviderProps> = ({
    children,
    initialRoute = '/loading',
}) => {
    const arena = useArena();

    const [currentRoute, setCurrentRoute] = useState<ArenaRoute>(initialRoute);
    const [previousRoute, setPreviousRoute] = useState<ArenaRoute | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [buildProgress, setBuildProgress] = useState<BuildProgress>({
        project: ROUTER_CONFIG.PROJECT_ID,
        percentage: 0,
        status: 'BUILDING',
        currentPhase: 'INITIALIZING',
        blockedRoutes: [],
        allowedRoutes: [...ROUTER_CONFIG.PUBLIC_ROUTES],
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 🔄 FETCH BUILD PROGRESS FROM SUPABASE
    // ═══════════════════════════════════════════════════════════════════════

    useEffect(() => {
        const fetchBuildProgress = async () => {
            if (!arena?.supabase) return;

            try {
                const { data, error } = await arena.supabase
                    .from('project_builds')
                    .select('*')
                    .eq('project_id', ROUTER_CONFIG.PROJECT_ID)
                    .single();

                if (error) {
                    // If table doesn't exist or no data, assume complete for development
                    console.warn('⚠️ SPATIAL_ROUTER: Build progress not found, assuming complete');
                    setBuildProgress(prev => ({
                        ...prev,
                        percentage: 100,
                        status: 'COMPLETE',
                        currentPhase: 'DEPLOYED',
                        allowedRoutes: [...ROUTER_CONFIG.PUBLIC_ROUTES, ...ROUTER_CONFIG.PROTECTED_ROUTES],
                    }));
                    return;
                }

                const percentage = data?.build_percentage ?? 100;
                const status: ProjectStatus = percentage >= 100 ? 'COMPLETE' : 'BUILDING';

                setBuildProgress({
                    project: ROUTER_CONFIG.PROJECT_ID,
                    percentage,
                    status,
                    currentPhase: data?.current_phase ?? 'UNKNOWN',
                    blockedRoutes: data?.blocked_routes ?? [],
                    allowedRoutes: percentage >= 100
                        ? [...ROUTER_CONFIG.PUBLIC_ROUTES, ...ROUTER_CONFIG.PROTECTED_ROUTES]
                        : [...ROUTER_CONFIG.PUBLIC_ROUTES, '/app', '/app/arena'],
                });
            } catch (err) {
                console.error('❌ SPATIAL_ROUTER: Failed to fetch build progress:', err);
            }
        };

        fetchBuildProgress();

        // Subscribe to real-time updates
        const subscription = arena?.supabase
            ?.channel('project_builds_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_builds' },
                (payload) => {
                    if (payload.new && (payload.new as any).project_id === ROUTER_CONFIG.PROJECT_ID) {
                        const data = payload.new as any;
                        const percentage = data.build_percentage ?? 0;
                        setBuildProgress(prev => ({
                            ...prev,
                            percentage,
                            status: percentage >= 100 ? 'COMPLETE' : 'BUILDING',
                            currentPhase: data.current_phase ?? prev.currentPhase,
                        }));
                    }
                }
            )
            .subscribe();

        return () => {
            subscription?.unsubscribe();
        };
    }, [arena?.supabase]);

    // ═══════════════════════════════════════════════════════════════════════
    // 🔐 AUTO-REDIRECT BASED ON AUTH STATE
    // ═══════════════════════════════════════════════════════════════════════

    useEffect(() => {
        if (arena?.isLoading) {
            setCurrentRoute('/loading');
            return;
        }

        // Redirect unauthenticated users to login
        if (!arena?.isAuthenticated && ROUTER_CONFIG.PROTECTED_ROUTES.includes(currentRoute)) {
            setCurrentRoute('/login');
        }

        // Redirect authenticated users away from login
        if (arena?.isAuthenticated && currentRoute === '/login') {
            setCurrentRoute('/app');
        }
    }, [arena?.isLoading, arena?.isAuthenticated, currentRoute]);

    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 NAVIGATION FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    const canNavigate = useCallback((route: ArenaRoute): boolean => {
        // Public routes always accessible
        if (ROUTER_CONFIG.PUBLIC_ROUTES.includes(route)) {
            return true;
        }

        // Check authentication
        if (!arena?.isAuthenticated) {
            return false;
        }

        // Check project lock
        if (buildProgress.percentage < ROUTER_CONFIG.UNLOCK_THRESHOLD) {
            // Only allow routes in the allowed list during build
            if (!buildProgress.allowedRoutes.includes(route)) {
                console.warn(`🔒 PROJECT_LOCK: Route "${route}" blocked. Build at ${buildProgress.percentage}%`);
                return false;
            }
        }

        // Check if route is explicitly blocked
        if (buildProgress.blockedRoutes.includes(route)) {
            return false;
        }

        return true;
    }, [arena?.isAuthenticated, buildProgress]);

    const navigate = useCallback(async (route: ArenaRoute): Promise<boolean> => {
        // Check if navigation is allowed
        if (!canNavigate(route)) {
            console.warn(`🚫 NAVIGATION_BLOCKED: Cannot navigate to "${route}"`);

            // Redirect to forbidden if trying to access locked route
            if (arena?.isAuthenticated && buildProgress.percentage < 100) {
                setCurrentRoute('/forbidden');
            }
            return false;
        }

        // Prevent duplicate navigation
        if (route === currentRoute) {
            return true;
        }

        // Begin transition
        setIsTransitioning(true);
        setPreviousRoute(currentRoute);

        // Wait for exit animation
        await new Promise(resolve => setTimeout(resolve, ROUTER_CONFIG.TRANSITION_DURATION / 2));

        // Update route
        setCurrentRoute(route);

        // Wait for enter animation
        await new Promise(resolve => setTimeout(resolve, ROUTER_CONFIG.TRANSITION_DURATION / 2));

        setIsTransitioning(false);
        return true;
    }, [canNavigate, currentRoute, arena?.isAuthenticated, buildProgress.percentage]);

    const goBack = useCallback(() => {
        if (previousRoute && canNavigate(previousRoute)) {
            navigate(previousRoute);
        }
    }, [previousRoute, canNavigate, navigate]);

    // ═══════════════════════════════════════════════════════════════════════
    // 📦 CONTEXT VALUE
    // ═══════════════════════════════════════════════════════════════════════

    const isLocked = buildProgress.percentage < ROUTER_CONFIG.UNLOCK_THRESHOLD;

    const contextValue = useMemo<RouterState>(() => ({
        currentRoute,
        previousRoute,
        isTransitioning,
        isLocked,
        buildProgress,
        canNavigate,
        navigate,
        goBack,
    }), [currentRoute, previousRoute, isTransitioning, isLocked, buildProgress, canNavigate, navigate, goBack]);

    return (
        <RouterContext.Provider value={contextValue}>
            {children}
        </RouterContext.Provider>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// 🪝 CUSTOM HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Primary router hook
 */
export const useArenaRouter = (): RouterState => {
    const context = useContext(RouterContext);
    if (!context) {
        throw new Error('useArenaRouter must be used within an ArenaRouterProvider');
    }
    return context;
};

/**
 * Project Lock enforcement hook
 */
export const useProjectLock = () => {
    const { isLocked, buildProgress } = useArenaRouter();
    const arena = useArena();

    useEffect(() => {
        if (arena?.isAuthenticated && isLocked) {
            console.warn(
                `🔒 PROJECT_LOCK_ACTIVE: Diamond Arena is ${buildProgress.percentage}% complete. ` +
                `Navigation restricted to: ${buildProgress.allowedRoutes.join(', ')}`
            );
        }
    }, [arena?.isAuthenticated, isLocked, buildProgress]);

    return {
        isLocked,
        percentage: buildProgress.percentage,
        status: buildProgress.status,
        currentPhase: buildProgress.currentPhase,
        allowedRoutes: buildProgress.allowedRoutes,
    };
};

/**
 * Route guard hook - redirects if not allowed
 */
export const useRouteGuard = (requiredRoute: ArenaRoute) => {
    const { canNavigate, navigate, currentRoute } = useArenaRouter();

    useEffect(() => {
        if (currentRoute === requiredRoute && !canNavigate(requiredRoute)) {
            navigate('/forbidden');
        }
    }, [currentRoute, requiredRoute, canNavigate, navigate]);
};

// ═══════════════════════════════════════════════════════════════════════════
// 🚧 ROUTE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

interface RouteProps {
    children: ReactNode;
}

/**
 * Protected Route wrapper - requires authentication
 */
export const ProtectedRoute: React.FC<RouteProps> = ({ children }) => {
    const arena = useArena();
    const { navigate } = useArenaRouter();

    useEffect(() => {
        if (!arena?.isLoading && !arena?.isAuthenticated) {
            navigate('/login');
        }
    }, [arena?.isLoading, arena?.isAuthenticated, navigate]);

    if (arena?.isLoading || !arena?.isAuthenticated) {
        return null;
    }

    return <>{children}</>;
};

/**
 * Project Locked Route wrapper - requires build completion
 */
export const UnlockedRoute: React.FC<RouteProps & { route: ArenaRoute }> = ({ children, route }) => {
    const { canNavigate, navigate } = useArenaRouter();

    useEffect(() => {
        if (!canNavigate(route)) {
            navigate('/forbidden');
        }
    }, [canNavigate, route, navigate]);

    if (!canNavigate(route)) {
        return null;
    }

    return <>{children}</>;
};

// ═══════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default ArenaRouterProvider;
