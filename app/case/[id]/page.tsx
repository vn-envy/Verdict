import { NeuralRoom } from "@/components/NeuralRoom";

// Hosts a deliberation. `id` encodes the source:
//   replay_<X>  -> cached house-case tape (instant)
//   new?claim=  -> start a live custom-claim deliberation
//   <case_id>   -> attach to an already-running live deliberation
export default function CasePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { claim?: string; prior?: string };
}) {
  return <NeuralRoom id={params.id} claim={searchParams.claim} prior={searchParams.prior} />;
}
