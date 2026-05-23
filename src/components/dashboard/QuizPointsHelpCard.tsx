import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { QUIZ_POINTS_HELP } from "@/lib/quiz-points";

type Props = {
  className?: string;
};

export function QuizPointsHelpCard({ className }: Props) {
  return (
    <Card className={cn("h-full border-primary/15", className)}>
      <CardHeader>
        <CardTitle className="text-base">How to earn points</CardTitle>
        <CardDescription>Sign in to save your balance for the leaderboard and shop.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
          {QUIZ_POINTS_HELP.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
