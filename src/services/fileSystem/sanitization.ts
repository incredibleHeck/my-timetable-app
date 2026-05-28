import { AppData } from "../../types";
import { parseAppData } from "../../schemas/appData";

/** @deprecated Use parseAppData from schemas/appData */
export const sanitizeAppData = (raw: unknown): AppData => parseAppData(raw);
