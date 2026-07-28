require('dotenv').config();
const pool = require('./db');


async function inspect() {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    console.log('Tables in database:', tables);
    for (let row of tables) {
      const tableName = Object.values(row)[0];
      const [columns] = await pool.query(`DESCRIBE ${tableName}`);
      console.log(`\nColumns of ${tableName}:`);
      console.table(columns);
      
      const [createTable] = await pool.query(`SHOW CREATE TABLE ${tableName}`);
      console.log(`\nCreate Table statement for ${tableName}:`);
      console.log(createTable[0]['Create Table']);
    }
  } catch (err) {
    console.error('Error inspecting database:', err);
  } finally {
    await pool.end();
  }
}
inspect();
