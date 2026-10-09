import type { GraphExp } from "@/core/experiment";
import { components } from "@/core/graph/edit";
import { GRAPH_DENSITY, GRAPH_MAX, GRAPH_MIN, makeGraph } from "@/core/graph/graph";
import { useLab, type GraphTool } from "@/store/lab";
import { Field, Section, Segmented, Select, Slider } from "../../primitives";

export function GraphProblem({ exp, reseed }: { exp: GraphExp; reseed: React.ReactNode }) {
  const update = useLab((s) => s.update);
  const g = exp.input;
  return (
    <Section title="Graph" aside={reseed}>
      <div className="space-y-4">
        <Slider
          label="Nodes"
          value={g.nodes.length}
          min={GRAPH_MIN}
          max={GRAPH_MAX}
          onChange={(n) =>
            update((e) => ({ ...e, input: makeGraph(n, g.seed, g.density) }) as GraphExp)
          }
        />
        <Field label="Edges per node">
          <Segmented
            label="Edges per node"
            value={String(g.density)}
            onChange={(d) =>
              update(
                (e) => ({ ...e, input: makeGraph(g.nodes.length, g.seed, Number(d)) }) as GraphExp,
              )
            }
            options={Array.from({ length: GRAPH_DENSITY.max - GRAPH_DENSITY.min + 1 }, (_, i) =>
              String(GRAPH_DENSITY.min + i),
            ).map((d) => ({ value: d, label: d }))}
            className="w-full"
          />
        </Field>
        <Field label="Prim's root node" htmlFor="root">
          <Select
            id="root"
            value={g.root}
            onChange={(ev) =>
              update((e) => ({ ...e, input: { ...g, root: Number(ev.target.value) } }) as GraphExp)
            }
          >
            {g.nodes.map((_, i) => (
              <option key={i} value={i}>
                Node {i}
              </option>
            ))}
          </Select>
        </Field>
        <GraphTools />
      </div>
    </Section>
  );
}

function GraphTools() {
  const tool = useLab((s) => s.graphTool);
  const setTool = useLab((s) => s.setGraphTool);
  const exp = useLab((s) => s.exp);
  const parts = exp.family === "graph" ? components(exp.input) : 1;
  return (
    <Field
      label="Edit the graph"
      hint="Edge weights are the distance between their nodes, so moving a node reweights its edges."
    >
      <Segmented<GraphTool>
        label="Graph tool"
        value={tool}
        onChange={setTool}
        className="w-full"
        options={[
          { value: "move", label: "Move", title: "Drag nodes; click a node to set the root" },
          { value: "edge", label: "Edge", title: "Click two nodes to add or remove an edge" },
          { value: "node", label: "Node", title: "Click empty space to add a node" },
          { value: "delete", label: "Delete", title: "Click a node or edge to delete it" },
        ]}
      />
      {parts > 1 && (
        <p className="text-xs text-signal-ink">
          The graph has {parts} disconnected parts, so the algorithms build a spanning forest.
        </p>
      )}
    </Field>
  );
}
