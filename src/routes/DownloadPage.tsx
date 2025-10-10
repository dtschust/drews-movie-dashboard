import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DownloadPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const movieTitle = searchParams.get('title');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Download initiated</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {movieTitle
            ? `Download started for "${movieTitle}". Feel free to queue up another search.`
            : 'Your download has been initiated successfully. Start another search to keep the queue going.'}
        </p>
        <Button onClick={() => navigate('/search')}>Start another search</Button>
      </CardContent>
    </Card>
  );
}
