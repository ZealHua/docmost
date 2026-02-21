import { Kysely, Transaction } from 'kysely';
import { DB } from '@docmost/db/types/db';

export type KyselyDB = Kysely<DB>;
export type KyselyTransaction = Transaction<DB>;
