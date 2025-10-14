import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEmbeddedAppContext } from '@/context/EmbeddedAppContext';
import { useWidgetState } from '@/lib/useWidgetState';

export function DownloadPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const movieTitle = searchParams.get('title');
  const location = useLocation();
  const { isEmbeddedApp } = useEmbeddedAppContext();
  const message = movieTitle
    ? `Download started for "${movieTitle}". Feel free to queue up another search.`
    : 'Your download has been initiated successfully. Start another search to keep the queue going.';

  const widgetPayload = useMemo(
    () => ({
      currentRoute: `${location.pathname}${location.search}`,
      routeName: 'download',
      data: {
        movieTitle,
        message,
      },
      summary: message,
    }),
    [location.pathname, location.search, movieTitle, message],
  );

  useWidgetState(isEmbeddedApp, widgetPayload);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Download initiated</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">{message}</p>
        <Button onClick={() => navigate('/search')}>Start another search</Button>
      </CardContent>
    </Card>
  );
}
