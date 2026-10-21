import { Suspense } from "react";

import { SprintPlanner } from "./sprint-planner";

async function Planner({ params }: Pick<PageProps<"/projects/[id]/sprints">, "params">) {
  const { id } = await params;
  return <SprintPlanner projectId={id} />;
}

export default function SprintsPage({ params }: PageProps<"/projects/[id]/sprints">) {
  return (
    <Suspense>
      <Planner params={params} />
    </Suspense>
  );
}
