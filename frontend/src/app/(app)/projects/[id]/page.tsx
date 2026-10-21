import { Suspense } from "react";

import { ProjectView } from "./project-view";

async function Project({ params }: Pick<PageProps<"/projects/[id]">, "params">) {
  const { id } = await params;
  return <ProjectView id={id} />;
}

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <Suspense>
      <Project params={params} />
    </Suspense>
  );
}
