import { AccountActions } from "./account";
import { TagActions } from "./tag";
import { TransactionActions } from "./transaction";

/*
NOTE: Update this when adding new actions
For example:
    type Action = TransactionActions | ProductActions;
*/
export type Action = AccountActions | TagActions | TransactionActions;

export default Action;
