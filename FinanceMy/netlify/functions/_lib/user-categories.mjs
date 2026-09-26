import { categoryNames, mergeCategories } from '../../../src/utils/taxonomy.js'

export async function userCategories(db, uid) {
  const snapshot = await db.collection(`users/${uid}/categories`).get()
  const categories = mergeCategories(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
  return { expense: categoryNames(categories, 'expense'), income: categoryNames(categories, 'income') }
}
