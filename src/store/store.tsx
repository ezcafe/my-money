// https://dev.to/elisealcala/react-context-with-usereducer-and-typescript-4obm

import React, { createContext, useReducer } from "react";
import PropTypes from "prop-types";
import Action from "../actions";
import mainReducer from "../reducers";
import { initialState, State } from "./initialState";

export interface IAppContext {
    state: State;
    dispatch: React.Dispatch<Action>;
}

export const AppContext = createContext<IAppContext>({
    state: initialState,
    dispatch: () => null,
});

const StateProvider: React.FC = ({ children }) => {
    const [state, dispatch] = useReducer<React.Reducer<State, Action>>(mainReducer, initialState);
    return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

StateProvider.propTypes = {
    children: PropTypes.any,
};

export default StateProvider;
