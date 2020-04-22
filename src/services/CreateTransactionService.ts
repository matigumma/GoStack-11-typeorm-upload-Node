// import AppError from '../errors/AppError';
import { getCustomRepository, getRepository } from 'typeorm';

import Category from '../models/Category';

import TransactionRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import AppError from '../errors/AppError';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TransactionRepository);
    const categoryRepo = getRepository(Category);

    if (type === 'outcome') {
      const balance = await transactionRepository.getBalance();
      if (value > balance.total) {
        throw new AppError('Insuficient founds', 400);
      }
    }

    let transactionCategory = await categoryRepo.findOne({
      where: { title: category },
    });

    if (!transactionCategory) {
      transactionCategory = categoryRepo.create({
        title: category,
      });
      await categoryRepo.save(transactionCategory);
    }

    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category: transactionCategory,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
