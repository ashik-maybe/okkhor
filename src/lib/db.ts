import Dexie, { type EntityTable } from "dexie";

export interface Doc {
  id?: number;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export const db = new Dexie("okkhor") as Dexie & {
  docs: EntityTable<Doc, "id">;
};

db.version(1).stores({
  docs: "++id, updatedAt, title",
});
