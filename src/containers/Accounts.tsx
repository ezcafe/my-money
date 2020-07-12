import React, { useContext } from "react";
import Account from "../components/Account";
import { AppContext, IAppContext } from "../store/store";
import { IAccount } from "../types/account";
import "../styles/Accounts.css";

const Accounts = () => {
    const {
        state: { accounts },
    } = useContext<IAppContext>(AppContext);
    return (
        <div className="ui divided items Page Accounts">
            {accounts.map(
                (account: IAccount): React.ReactElement => {
                    return <Account key={account.id} account={account} />;
                },
            )}
        </div>
    );
};

export default Accounts;
