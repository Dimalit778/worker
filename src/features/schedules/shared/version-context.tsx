'use client';
import { createContext, useContext } from 'react';
import type { VersionExpectation } from '../services/transactions';
const VersionContext = createContext<VersionExpectation>({ versionId: null, revision: 0 });
export const VersionProvider = VersionContext.Provider;
export function useVersionExpectation() { return useContext(VersionContext); }
