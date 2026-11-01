export interface TreeNode {
  name: string;
  dependsOn: string[];
}

/**
 * Sorts nodes into batches: each batch only depends on earlier batches.
 * Dependencies outside `nodes` are ignored (already published or external).
 */
export const sortReleaseTree = <T extends TreeNode>(nodes: T[]): T[][] => {
  const names = new Set(nodes.map((node) => node.name));
  const released = new Set<string>();
  const tree: T[][] = [];
  let remaining = nodes;

  while (remaining.length) {
    const batch = remaining.filter((node) =>
      node.dependsOn.every((dep) => !names.has(dep) || released.has(dep)),
    );
    if (!batch.length)
      throw new Error(
        `Unresolvable dependency order among: ${remaining.map((node) => node.name).join(", ")}`,
      );
    for (const node of batch) released.add(node.name);
    tree.push(batch);
    remaining = remaining.filter((node) => !released.has(node.name));
  }

  return tree;
};

/** `roots` plus every node they depend on, directly or not. */
export const withDependencies = <T extends TreeNode>(nodes: T[], roots: Iterable<string>): T[] => {
  const byName = new Map(nodes.map((node) => [node.name, node]));
  const needed = new Set<string>();
  const visit = (name: string) => {
    if (needed.has(name) || !byName.has(name)) return;
    needed.add(name);
    for (const dep of byName.get(name)?.dependsOn ?? []) visit(dep);
  };
  for (const root of roots) visit(root);
  return nodes.filter((node) => needed.has(node.name));
};
