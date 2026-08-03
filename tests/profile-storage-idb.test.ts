import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import * as WebDb from "../src/services/profile/webDb";
import * as ProfileStorage from "../src/services/profile/profileStorage";
import { Profile } from "../src/types/profile";
import { DEFAULT_DATA } from "../src/utils/constants";

const makeProfile = (id: string, name: string): Profile => ({
  id,
  name,
  created: Date.now(),
  lastModified: Date.now(),
  data: DEFAULT_DATA,
  meta: {},
});

beforeEach(() => {
  // Fresh IndexedDB + localStorage per test.
  globalThis.indexedDB = new IDBFactory();
  WebDb.__resetDbForTests();
  localStorage.clear();
});

describe("profileStorage (IndexedDB web backend)", () => {
  it("saves, lists, and loads a profile", async () => {
    await ProfileStorage.init();
    await ProfileStorage.saveProfile(makeProfile("a", "Alpha"));

    const list = await ProfileStorage.listProfiles();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "a", name: "Alpha" });

    const loaded = await ProfileStorage.loadProfile("a");
    expect(loaded?.name).toBe("Alpha");
  });

  it("sets the first saved profile as active automatically", async () => {
    await ProfileStorage.init();
    await ProfileStorage.saveProfile(makeProfile("a", "Alpha"));
    await ProfileStorage.saveProfile(makeProfile("b", "Beta"));
    expect(await ProfileStorage.getActiveProfileId()).toBe("a");
  });

  it("switches the active profile", async () => {
    await ProfileStorage.init();
    await ProfileStorage.saveProfile(makeProfile("a", "Alpha"));
    await ProfileStorage.saveProfile(makeProfile("b", "Beta"));
    await ProfileStorage.setActiveProfile("b");
    expect(await ProfileStorage.getActiveProfileId()).toBe("b");
  });

  it("deletes a profile and reassigns active when needed", async () => {
    await ProfileStorage.init();
    await ProfileStorage.saveProfile(makeProfile("a", "Alpha"));
    await ProfileStorage.saveProfile(makeProfile("b", "Beta"));
    await ProfileStorage.setActiveProfile("a");

    await ProfileStorage.deleteProfile("a");
    const list = await ProfileStorage.listProfiles();
    expect(list.map((p) => p.id)).toEqual(["b"]);
    expect(await ProfileStorage.getActiveProfileId()).toBe("b");
  });

  it("migrates existing localStorage profiles into IndexedDB on init", async () => {
    // Seed the legacy localStorage backend.
    const legacy = makeProfile("legacy1", "Legacy One");
    localStorage.setItem(`profile_data_${legacy.id}`, JSON.stringify(legacy));
    localStorage.setItem(
      "profile_manifest",
      JSON.stringify({
        profiles: [{ id: legacy.id, name: legacy.name, lastModified: legacy.lastModified }],
        activeProfileId: "legacy1",
      }),
    );

    await ProfileStorage.init();

    const list = await ProfileStorage.listProfiles();
    expect(list.map((p) => p.id)).toContain("legacy1");
    expect(await ProfileStorage.getActiveProfileId()).toBe("legacy1");
    // Old localStorage keys are cleared to free space.
    expect(localStorage.getItem("profile_manifest")).toBeNull();
    expect(localStorage.getItem("profile_data_legacy1")).toBeNull();
  });

  it("reconciles an emergency pending flush on init", async () => {
    await ProfileStorage.init();
    const snapshot = makeProfile("p", "Pending Edit");
    localStorage.setItem("pending_flush", JSON.stringify(snapshot));

    // Re-init (simulates next app load) should apply the snapshot.
    WebDb.__resetDbForTests();
    await ProfileStorage.init();

    const loaded = await ProfileStorage.loadProfile("p");
    expect(loaded?.name).toBe("Pending Edit");
    expect(localStorage.getItem("pending_flush")).toBeNull();
  });
});
