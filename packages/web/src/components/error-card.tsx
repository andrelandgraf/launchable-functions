import { XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type ErrorCardProps = {
  errors: string[];
};

export function ErrorCard({ errors }: ErrorCardProps) {
  if (errors.length === 0) return null;

  return (
    <Card className="border-destructive bg-destructive/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
          <p className="font-semibold text-destructive">There were errors with your submission</p>
        </div>
        <ul className="ml-6 mt-2 list-disc text-sm text-destructive">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
