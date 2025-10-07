import { faker } from '@faker-js/faker';
import { sleep } from '../../../src/common/utils';

const fakeUsername = faker.internet.userName;

export const userHeader = ['Id', 'Name', 'Email', 'Birth', 'Savings'];

let id = 0;
const savingsOptions = { min: 1000, max: 10000 };
export const userA = {
    id: id++,
    name: fakeUsername(),
    email: faker.internet.email(),
    birth: faker.date.birthdate(),
    savings: faker.number.int(savingsOptions),
};
export const userB = {
    id: id++,
    name: fakeUsername(),
    email: faker.internet.email(),
    birth: faker.date.birthdate(),
    savings: faker.number.int(savingsOptions),
};
export const userC = {
    id: id++,
    name: fakeUsername(),
    email: faker.internet.email(),
    birth: faker.date.birthdate(),
    savings: faker.number.int(savingsOptions),
};

export const userList = [userA, userB, userC];

export function userFetchFn() {
    let count = 0;
    return async () => {
        await sleep(10);
        if (count >= userList.length) return null;
        return userList[count++];
    };
}
