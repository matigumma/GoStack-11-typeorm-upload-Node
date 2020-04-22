import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionRepository from '../repositories/TransactionsRepository';

interface CSVtransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filepath: string): Promise<Transaction[]> {
    const transactionRepo = getCustomRepository(TransactionRepository);
    const categoryRepo = getRepository(Category);

    // read stream of file:
    const readStream = fs.createReadStream(filepath);

    // csvParse instance configured with reading start line 2 (line 1 has headers)
    const parser = csvParse({
      from_line: 2,
    });

    // pipe read the lines
    const parsedCsv = readStream.pipe(parser);

    const transactions: CSVtransaction[] = [];
    const categories: string[] = [];

    // parseCsv events 'data' each line execute:
    parsedCsv.on('data', async line => {
      // map line, trim spaces, return unstructured array const
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      // minimum required elements to intert a new transaction, if not any drop line..
      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });
    // waitn until parsedCSV finish
    await new Promise(resolve => parsedCsv.on('end', resolve));

    // map categories from CSV  with existents on db
    const existentCategories = await categoryRepo.find({
      where: {
        title: In(categories),
      },
    });

    // map only titles from existentsCategories
    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    // filter categories that exist on db (mean: be included on existentCategoriesTitles) && remove duplicates
    const addCategoriesTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    // create categories maping each category and return like an object { title: title }
    const newCategories = categoryRepo.create(
      addCategoriesTitles.map(title => ({
        title,
      })),
    );
    // save finally all cats
    await categoryRepo.save(newCategories);

    // finalCats the mix of new and existents on db
    const finalCategories = [...newCategories, ...existentCategories];

    // create transactions to insert on db, maping each transaction and it self category on finalCats..
    const createdTransactions = transactionRepo.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    // save transactions
    await transactionRepo.save(createdTransactions);

    // remove file
    await fs.promises.unlink(filepath);

    // return finally the created transactions from csv file
    return createdTransactions;
  }
}

export default ImportTransactionsService;
