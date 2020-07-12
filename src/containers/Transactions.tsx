import React, { useContext } from "react";
import { groupBy } from "lodash";
import { DateTime } from "luxon";

import Transaction from "../components/Transaction";
import { AppContext, IAppContext } from "../store/store";
import { ITransaction } from "../types/transaction";
import "../styles/Transactions.css";

type IGroup = ITransaction[];
interface IGroups {
    [date: string]: IGroup;
}

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
    group: IGroup;
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

    const groups: IGroups = groupBy(transactions, ({ time }: ITransaction) => {
        const date = DateTime.fromMillis(time);
        return date.toLocaleString(DateTime.DATE_SHORT);
    });
    const dates: string[] = Object.keys(groups);

    return (
        <div className="ui Page Tags">
            {dates.map((date: string): React.ReactElement | null => {
                const group: IGroup = groups[date];
                if (!group || group.length === 0) {
                    return null;
                }

                return (
                    <React.Fragment key={date}>
                        <GroupHeaderComponent date={date} />
                        <GroupBodyComponent group={group} />
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default Transactions;
