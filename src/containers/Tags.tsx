import React, { useContext } from "react";

import Tag from "../components/Tag";
import { AppContext, IAppContext } from "../store/store";
import { ITag } from "../types/tag";

import "../styles/Tags.css";

const Tags = () => {
    const {
        state: { tags },
    } = useContext<IAppContext>(AppContext);

    return (
        <div className="ui divided items Page Transactions">
            {tags.map(
                (tag: ITag): React.ReactElement => {
                    return <Tag key={tag.id} tag={tag} />;
                },
            )}
        </div>
    );
};

export default Tags;
