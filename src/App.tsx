import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import './index.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Maximize2, Moon, Sun } from 'lucide-react';
import { useEmbeddedAppContext } from './context/EmbeddedAppContext';
import { rememberMovies } from '@/lib/movieCache';
import { getTopMovies } from './api';
import type { MovieSummary, Theme } from './types';
import { SearchPage } from '@/routes/SearchPage';
import { VersionsPage } from '@/routes/VersionsPage';
import { DownloadPage } from '@/routes/DownloadPage';
import { toErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useOpenAiGlobal, useToolInput } from '@/lib/skybridge';

const APP_CONTAINER_BASE_CLASSES = 'mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10';

interface LocalTokenState {
  token: string;
  saveToken: (token: string) => void;
  clearToken: () => void;
}

function useLocalToken(): LocalTokenState {
  const [token, setToken] = useState<string>('');
  useEffect(() => {
    try {
      setToken(localStorage.getItem('token') || '');
    } catch {
      /* noop */
    }
  }, []);

  const saveToken = (value: string) => {
    try {
      localStorage.setItem('token', value);
    } catch {
      /* noop */
    }
    setToken(value);
  };

  const clearToken = () => {
    try {
      localStorage.removeItem('token');
    } catch {
      /* noop */
    }
    setToken('');
  };

  return { token, saveToken, clearToken };
}

interface TokenGateProps {
  onSaved: (token: string) => void;
}

function TokenGate({ onSaved }: TokenGateProps) {
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  const save = () => {
    if (!value.trim()) {
      setError('Please enter a token');
      return;
    }
    try {
      localStorage.setItem('token', value.trim());
    } catch {
      /* noop */
    }
    onSaved(value.trim());
  };

  return (
    <div className="flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Enter API token</CardTitle>
          <p className="text-sm text-muted-foreground">
            Store your token locally to access the API.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Missing token</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="password"
              placeholder="Paste token..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
            />
            <Button className="w-full sm:w-auto" onClick={save}>
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your token is only stored locally in this browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface AppLayoutProps {
  onLogout: () => void;
  error: string;
  onRestart: () => void;
  onToggleTheme: () => void;
  onToggleFullscreen: () => void;
  theme: Theme;
  isEmbeddedApp: boolean;
  children: ReactNode;
}

function AppLayout({
  onLogout,
  error,
  onRestart,
  onToggleTheme,
  onToggleFullscreen,
  theme,
  isEmbeddedApp,
  children,
}: AppLayoutProps) {
  const mode = useOpenAiGlobal('displayMode');
  const containerClassName = cn(
    APP_CONTAINER_BASE_CLASSES,
    isEmbeddedApp && 'max-h-[600px] overflow-y-auto py-3',
  );
  const [logoutOpen, setLogoutOpen] = useState<boolean>(false);
  return (
    <div className={containerClassName}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onRestart}
            className={cn(
              'text-left font-semibold text-foreground transition hover:text-primary focus:outline-none focus-visible:underline',
              isEmbeddedApp ? 'text-xl' : 'text-3xl',
            )}
          >
            Drew's Movie Dashboard
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {isEmbeddedApp ? (
            mode !== 'fullscreen' && (
              <Button
                variant="outline"
                onClick={onToggleFullscreen}
                aria-label={`Switch to fullscreen mode`}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onToggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={() => setLogoutOpen(true)}>
                Log out
              </Button>
            </>
          )}
        </div>
      </header>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? You will need to enter your API token again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLogoutOpen(false);
                onLogout();
              }}
            >
              Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error}</span>
            <Button variant="outline" onClick={onRestart} className="w-fit">
              Restart
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className={cn('space-y-6', isEmbeddedApp && 'space-y-3')}>{children}</div>
    </div>
  );
}

export default function App() {
  const { isEmbeddedApp } = useEmbeddedAppContext();
  const toolInput = useToolInput();
  const { search } = toolInput ?? {};

  useEffect(() => {
    if (search) {
      setError('');
      navigate(`/search?query=${search}`, { replace: true });
    }
  }, [search]);

  const navigate = useNavigate();
  const { token, saveToken, clearToken } = useLocalToken();
  const [topMovies, setTopMovies] = useState<MovieSummary[]>([]);
  const [error, setError] = useState<string>('');
  const topMoviesRequested = useRef<boolean>(false);
  const [isManualTheme, setIsManualTheme] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem('theme');
      return stored === 'light' || stored === 'dark';
    } catch {
      return false;
    }
  });
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      /* noop */
    }
    const prefersDark =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (isManualTheme) {
      try {
        localStorage.setItem('theme', theme);
      } catch {
        /* noop */
      }
    } else {
      try {
        localStorage.removeItem('theme');
      } catch {
        /* noop */
      }
    }
  }, [theme, isManualTheme]);

  useEffect(() => {
    if (isManualTheme) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? 'dark' : 'light');
    };

    setTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [isManualTheme]);

  const toggleFullscreen = () => {
    if (isEmbeddedApp) {
      window.openai?.requestDisplayMode?.({ mode: 'fullscreen' });
    }
  };

  const toggleTheme = () => {
    setIsManualTheme(true);
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const containerClassName = cn(
    APP_CONTAINER_BASE_CLASSES,
    isEmbeddedApp && 'max-h-[600px] overflow-y-auto',
  );

  useEffect(() => {
    if (!token) return;
    if (topMoviesRequested.current) return;
    topMoviesRequested.current = true;

    let cancelled = false;

    async function fetchTop() {
      try {
        const { movies: list } = await getTopMovies(isEmbeddedApp);
        if (!cancelled) {
          const nextTop = Array.isArray(list) ? list : [];
          rememberMovies(nextTop);
          setTopMovies(nextTop);
        }
      } catch (fetchError: unknown) {
        if (!cancelled) {
          console.error(fetchError);
          setError(toErrorMessage(fetchError));
        }
      }
    }

    fetchTop();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return (
      <div className={containerClassName}>
        <TokenGate
          onSaved={(value) => {
            saveToken(value);
            setError('');
            setTopMovies([]);
            topMoviesRequested.current = false;
            navigate('/search', { replace: true });
          }}
        />
      </div>
    );
  }

  const handleLogout = () => {
    clearToken();
    setError('');
    setTopMovies([]);
    topMoviesRequested.current = false;
    navigate('/', { replace: true });
  };

  const handleRestart = () => {
    setError('');
    topMoviesRequested.current = false;
    navigate('/search', { replace: true });
  };

  return (
    <AppLayout
      onLogout={handleLogout}
      error={error}
      onRestart={handleRestart}
      onToggleFullscreen={toggleFullscreen}
      onToggleTheme={toggleTheme}
      theme={theme}
      isEmbeddedApp={isEmbeddedApp}
    >
      <Routes>
        <Route
          path="/"
          element={
            <SearchPage isEmbeddedApp={isEmbeddedApp} topMovies={topMovies} setError={setError} />
          }
        />
        <Route
          path="/search"
          element={
            <SearchPage isEmbeddedApp={isEmbeddedApp} topMovies={topMovies} setError={setError} />
          }
        />
        <Route path="/torrents/:movieId" element={<VersionsPage setError={setError} />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="*" element={<Navigate to="/search" replace />} />
      </Routes>
    </AppLayout>
  );
}
