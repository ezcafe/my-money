import React, { useContext } from "react";
import { AppContext, IAppContext } from "../store/store";
import { removeTagAction } from "../actions/tag";
import { ITag } from "../types/tag";
import "../styles/Tag.css";

interface ITagProps {
    tag: ITag;
}

const Tag = (props: ITagProps) => {
    const { dispatch } = useContext<IAppContext>(AppContext);
    const {
        tag: { id, name },
    } = props;

    const removeTag = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(removeTagAction(id));
    };

    return (
        <div className="item Tag">
            <div className="content">
                <div className="header">{name}</div>
                <div className="extra">
                    <button className="negative mini ui button" onClick={removeTag}>
                        DELETE
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Tag;
