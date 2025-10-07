
const throwHttpException = (_error, httpStatus = 500) => {
    const error = typeof _error === 'string' ? new Error(_error) : _error;
    error['status'] = httpStatus;
    throw error;
};

const exitRequest = (_error, httpStatus = 200) => {
    const error = typeof _error === 'string' ? new Error(_error) : _error;
    error['status'] = httpStatus;
    throw error;
};

export { throwHttpException, exitRequest };
