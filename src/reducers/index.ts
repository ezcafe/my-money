import { accountReducer } from "./account";
import { tagReducer } from "./tag";
import { transactionReducer } from "./transaction";

import Action from "../actions";
import { State } from "../store/initialState";

/*
NOTE: Update this when adding new reducers
For example:
    const mainReducer = (state: State, action: Action) => ({
        transactions: transactionReducer(state.transactions, action),
        products: productReducer(state.products, action),
    });
*/
export const mainReducer: React.Reducer<State, Action> = (state: State, action: Action) => ({
    accounts: accountReducer(state.accounts, action),
    tags: tagReducer(state.tags, action),
    transactions: transactionReducer(state.transactions, action),
});

export default mainReducer;
