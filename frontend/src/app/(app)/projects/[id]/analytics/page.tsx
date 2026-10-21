import { Suspense } from "react";

import { ProjectAnalytics } from "./project-analytics";

async function Analytics({ params }: Pick<PageProps<"/projects/[id]/analytics">, "params">) {
  const { id } = await params;
  return <ProjectAnalytics projectId={id} />;
}

export default function AnalyticsPage({ params }: PageProps<"/projects/[id]/analytics">) {
  return (
    <Suspense>
      <Analytics params={params} />
    </Suspense>
  );
}
