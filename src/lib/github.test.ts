import { beforeEach, describe, expect, mock, test } from "bun:test";
import process from "node:process";

process.env.GITHUB_TOKEN = "test-token";

type Handler = (args: never) => Promise<unknown>;

let handlers: Record<string, Handler> = {};
let calls: Record<string, unknown[]> = {};

const endpoint =
  (name: string) =>
  async (args: unknown): Promise<unknown> => {
    calls[name]?.push(args);
    const handler = handlers[name];
    if (!handler) throw new Error(`no handler stubbed for ${name}`);
    return handler(args as never);
  };

const octokit = {
  rest: {
    git: {
      createRef: endpoint("createRef"),
      getRef: endpoint("getRef"),
      updateRef: endpoint("updateRef"),
    },
    repos: { createRelease: endpoint("createRelease") },
  },
};

mock.module("@actions/github", () => ({
  context: { repo: { owner: "Org", repo: "Repo" }, payload: {} },
  getOctokit: () => octokit,
}));

const { createRelease, createTag, moveTag } = await import("./github");

const failure = (status: number, message: string) => Object.assign(new Error(message), { status });

beforeEach(() => {
  handlers = {};
  calls = { createRef: [], getRef: [], updateRef: [], createRelease: [] };
});

describe("createTag", () => {
  test("creates the ref", async () => {
    handlers.createRef = async () => ({});
    await createTag("v1.0.0", "sha1");
    expect(calls.createRef).toEqual([
      { owner: "Org", repo: "Repo", ref: "refs/tags/v1.0.0", sha: "sha1" },
    ]);
  });

  test("an already existing tag on the same sha only warns", async () => {
    handlers.createRef = async () => {
      throw failure(422, "Reference already exists");
    };
    handlers.getRef = async () => ({ data: { object: { sha: "sha1" } } });
    await expect(createTag("v1.0.0", "sha1")).resolves.toBeUndefined();
  });

  test("an already existing tag on another sha throws", async () => {
    handlers.createRef = async () => {
      throw failure(422, "Reference already exists");
    };
    handlers.getRef = async () => ({ data: { object: { sha: "other" } } });
    await expect(createTag("v1.0.0", "sha1")).rejects.toThrow(
      'Tag "v1.0.0" already exists on other, not on sha1',
    );
  });

  test("a 422 that is not 'already exists' throws", async () => {
    handlers.createRef = async () => {
      throw failure(422, "Validation Failed: ref is not a valid name");
    };
    await expect(createTag("v1.0.0", "sha1")).rejects.toThrow('Failed to create tag "v1.0.0"');
  });

  test("a non-422 failure throws", async () => {
    handlers.createRef = async () => {
      throw failure(500, "boom");
    };
    await expect(createTag("v1.0.0", "sha1")).rejects.toThrow(
      'Failed to create tag "v1.0.0": boom',
    );
  });
});

describe("moveTag", () => {
  test("force-updates the ref", async () => {
    handlers.updateRef = async () => ({});
    await moveTag("v1", "sha1");
    expect(calls.updateRef).toEqual([
      { owner: "Org", repo: "Repo", ref: "tags/v1", sha: "sha1", force: true },
    ]);
  });

  test("creates the tag when it does not exist yet", async () => {
    handlers.updateRef = async () => {
      throw failure(422, "Reference does not exist");
    };
    handlers.createRef = async () => ({});
    await expect(moveTag("v1", "sha1")).resolves.toBeUndefined();
    expect(calls.createRef).toHaveLength(1);
  });

  test("a 422 that is not 'does not exist' throws", async () => {
    handlers.updateRef = async () => {
      throw failure(422, "Validation Failed: something else");
    };
    await expect(moveTag("v1", "sha1")).rejects.toThrow('Failed to move tag "v1"');
  });

  test("a non-422 failure throws", async () => {
    handlers.updateRef = async () => {
      throw failure(500, "boom");
    };
    await expect(moveTag("v1", "sha1")).rejects.toThrow('Failed to move tag "v1": boom');
  });
});

describe("createRelease", () => {
  test("creates the release, generating notes when there is no body", async () => {
    handlers.createRelease = async () => ({});
    await createRelease("v1.0.0", "sha1", undefined, true);
    expect(calls.createRelease).toEqual([
      {
        owner: "Org",
        repo: "Repo",
        tag_name: "v1.0.0",
        target_commitish: "sha1",
        name: "v1.0.0",
        body: "",
        generate_release_notes: true,
        make_latest: "true",
      },
    ]);
  });

  test("uses the given body and latest flag", async () => {
    handlers.createRelease = async () => ({});
    await createRelease("v1.0.0", "sha1", "the notes", false);
    const args = calls.createRelease?.[0] as {
      body: string;
      generate_release_notes: boolean;
      make_latest: string;
    };
    expect(args.body).toBe("the notes");
    expect(args.generate_release_notes).toBe(false);
    expect(args.make_latest).toBe("false");
  });

  test("an already existing release only warns", async () => {
    handlers.createRelease = async () => {
      throw failure(422, 'Validation Failed: {"code":"already_exists","field":"tag_name"}');
    };
    await expect(createRelease("v1.0.0", "sha1", "notes", true)).resolves.toBeUndefined();
  });

  test("a 422 without already_exists throws", async () => {
    handlers.createRelease = async () => {
      throw failure(422, "Validation Failed: tag_name is not valid");
    };
    await expect(createRelease("v1.0.0", "sha1", "notes", true)).rejects.toThrow(
      'Failed to create the GitHub release "v1.0.0"',
    );
  });

  test("a non-422 failure throws", async () => {
    handlers.createRelease = async () => {
      throw failure(500, "boom");
    };
    await expect(createRelease("v1.0.0", "sha1", "notes", true)).rejects.toThrow(
      'Failed to create the GitHub release "v1.0.0": boom',
    );
  });
});
