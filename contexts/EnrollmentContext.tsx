import React, { createContext } from 'react';
import { EnrollmentState, EnrollmentAction } from '../types';

export const EnrollmentContext = createContext<{
  state: EnrollmentState;
  dispatch: React.Dispatch<EnrollmentAction>;
} | undefined>(undefined);
