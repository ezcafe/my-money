const requiredRules = {
    required: "This field is required",
};

const minMaxRules = {
    min: {
        value: 0,
        message: "0 is minimum",
    },
    max: {
        value: 100,
        message: "100 is maximum",
    },
};

export const percentTotalMessage = "Total percent of all account should not be greater than 100";

export const percentRules = {
    ...requiredRules,
    ...minMaxRules,
};
