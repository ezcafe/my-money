import React, { useContext } from "react";
import { DateTime } from "luxon";

import Transaction from "../components/Transaction";
import { AppContext, IAppContext } from "../store/store";
import { ITransaction, ITransactionGroup } from "../types/transaction";
import "../styles/Transactions.css";

interface IGroupHeaderComponentProps {
    date: string;
}

const GroupHeaderComponent = (props: IGroupHeaderComponentProps): React.ReactElement => {
    const { date } = props;
    return (
        <h2 className="ui header">
            {date}
            {/* <div className="sub header">{account.note}</div> */}
        </h2>
    );
};

interface IGroupBodyComponentProps {
    group: ITransactionGroup;
}

const GroupBodyComponent = (props: IGroupBodyComponentProps): React.ReactElement => {
    const { group } = props;
    return (
        <div className="ui segments">
            {group.map(
                (transaction: ITransaction): React.ReactElement => {
                    return (
                        <div key={transaction.id} className="ui segment">
                            <Transaction transaction={transaction} />
                        </div>
                    );
                },
            )}
        </div>
    );
};

const Transactions = () => {
    const {
        state: { transactions },
    } = useContext<IAppContext>(AppContext);
    const dates: string[] = Object.keys(transactions);

    return (
        <div className="ui Page Tags">
            {dates.map((groupKey: string): React.ReactElement | null => {
                const group: ITransactionGroup = transactions[groupKey];
                if (!group || group.length === 0) {
                    return null;
                }

                const monthYear = DateTime.fromMillis(group[0].time).toFormat("MMM yyyy");
                return (
                    <React.Fragment key={groupKey}>
                        <GroupHeaderComponent date={monthYear} />
                        <GroupBodyComponent group={group} />
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default Transactions;
