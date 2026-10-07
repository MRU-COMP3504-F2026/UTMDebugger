import {Database} from '../database/manager.js';

// The single entry point for the listener. The manager owns all IndexedDB operations.
export const database = new Database();
