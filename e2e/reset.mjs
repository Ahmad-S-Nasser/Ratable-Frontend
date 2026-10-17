// Drops the throwaway database so each end-to-end run starts clean.
import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017");
await client.connect();
await client.db("ratable_e2e").dropDatabase();
await client.close();
