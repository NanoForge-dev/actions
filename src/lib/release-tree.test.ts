import { expect, test } from "bun:test";

import { selectNfPackages } from "../nf-registry-release/packages";
import { sortReleaseTree, withDependencies } from "./release-tree";

const node = (name: string, ...dependsOn: string[]) => ({ name, dependsOn, path: name });
const names = (tree: { name: string }[][]) => tree.map((batch) => batch.map(({ name }) => name));

test("sortReleaseTree publishes dependencies first, ignoring external ones", () => {
  const tree = sortReleaseTree([
    node("app", "core", "react"),
    node("core", "common"),
    node("common"),
    node("ui", "common"),
  ]);
  expect(names(tree)).toEqual([["common"], ["core", "ui"], ["app"]]);
});

test("sortReleaseTree refuses a cycle", () => {
  expect(() => sortReleaseTree([node("a", "b"), node("b", "a")])).toThrow(/Unresolvable/);
});

test("withDependencies adds transitive dependencies", () => {
  const all = [node("a", "b"), node("b", "c"), node("c"), node("d")];
  expect(withDependencies(all, ["a"]).map(({ name }) => name)).toEqual(["a", "b", "c"]);
});

test("selectNfPackages: one package with its dependencies", () => {
  const all = [node("a", "b"), node("b"), node("c")];
  expect(selectNfPackages(all, "a", []).map(({ name }) => name)).toEqual(["a", "b"]);
  expect(() => selectNfPackages(all, "z", [])).toThrow(/not releasable/);
});

test("selectNfPackages: exclude keeps what released packages need", () => {
  const all = [node("a", "b"), node("b"), node("c")];
  expect(selectNfPackages(all, "all", ["b", "c"]).map(({ name }) => name)).toEqual(["a", "b"]);
  expect(selectNfPackages(all, "", []).map(({ name }) => name)).toEqual(["a", "b", "c"]);
});

test("selectNfPackages refuses unknown dependencies", () => {
  expect(() => selectNfPackages([node("a", "ghost")], "", [])).toThrow(/a → ghost/);
});
