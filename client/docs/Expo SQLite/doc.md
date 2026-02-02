Expo SQLite
A library that provides access to a database that can be queried through a SQLite API.


Ask AI




Bundled version:
~16.0.10

Copy page

expo-sqlite gives your app access to a database that can be queried through a SQLite API. The database is persisted across restarts of your app.

On Apple TV, the underlying database file is in the caches directory and not the application documents directory, per Apple platform guidelines.
Installation
Terminal

Copy

npx expo install expo-sqlite
If you are installing this in an existing React Native app, make sure to install expo in your project.

Configuration in app config
You can configure expo-sqlite for advanced configurations using its built-in config plugin if you use config plugins in your project (Continuous Native Generation (CNG)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does not use CNG, then you'll need to manually configure the library.

Example app.json with config plugin
app.json

Copy


{
  "expo": {
    "plugins": [
      [
        "expo-sqlite",
        {
          "enableFTS": true,
          "useSQLCipher": true,
          "android": {
            // Override the shared configuration for Android
            "enableFTS": false,
            "useSQLCipher": false
          },
          "ios": {
            // You can also override the shared configurations for iOS
            "customBuildFlags": ["-DSQLITE_ENABLE_DBSTAT_VTAB=1 -DSQLITE_ENABLE_SNAPSHOT=1"]
          }
        }
      ]
    ]
  }
}

Show More
Configurable properties
Name	Default	Description
customBuildFlags	-	
Custom build flags to be passed to the SQLite build process.

enableFTS	true	
Whether to enable the FTS3, FTS4 and FTS5 extensions.

useSQLCipher	false	
Use the SQLCipher implementations rather than the default SQLite.

withSQLiteVecExtension	false	
Include the sqlite-vec extension to bundledExtensions.

Web setup
Web support is in alpha and may be unstable. Create an issue on GitHub if you encounter any issues.
To use expo-sqlite on web, you need to configure Metro bundler to support wasm files and add HTTP headers to allow SharedArrayBuffer usage.

Add the following configuration to your metro.config.js. If you don't have the metro.config.js yet, you can run npx expo customize metro.config.js. Learn more.

metro.config.js

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
 
// Add wasm asset support
config.resolver.assetExts.push('wasm');
 
// Add COEP and COOP headers to support SharedArrayBuffer
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};
 
module.exports = config;
 
If you deploy your app to web hosting services, you will also need to add the Cross-Origin-Embedder-Policy and Cross-Origin-Opener-Policy headers to your web server. Learn more about the COEP, COOP headers, and SharedArrayBuffer.

Usage
Import the module from expo-sqlite.

Import the module from expo-sqlite

Copy


import * as SQLite from 'expo-sqlite';
Basic CRUD operations
Basic CRUD operations

Copy


const db = await SQLite.openDatabaseAsync('databaseName');

// `execAsync()` is useful for bulk queries when you want to execute altogether.
// Note that `execAsync()` does not escape parameters and may lead to SQL injection.
await db.execAsync(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY NOT NULL, value TEXT NOT NULL, intValue INTEGER);
INSERT INTO test (value, intValue) VALUES ('test1', 123);
INSERT INTO test (value, intValue) VALUES ('test2', 456);
INSERT INTO test (value, intValue) VALUES ('test3', 789);
`);

// `runAsync()` is useful when you want to execute some write operations.
const result = await db.runAsync('INSERT INTO test (value, intValue) VALUES (?, ?)', 'aaa', 100);
console.log(result.lastInsertRowId, result.changes);
await db.runAsync('UPDATE test SET intValue = ? WHERE value = ?', 999, 'aaa'); // Binding unnamed parameters from variadic arguments
await db.runAsync('UPDATE test SET intValue = ? WHERE value = ?', [999, 'aaa']); // Binding unnamed parameters from array
await db.runAsync('DELETE FROM test WHERE value = $value', { $value: 'aaa' }); // Binding named parameters from object

// `getFirstAsync()` is useful when you want to get a single row from the database.
const firstRow = await db.getFirstAsync('SELECT * FROM test');
console.log(firstRow.id, firstRow.value, firstRow.intValue);

// `getAllAsync()` is useful when you want to get all results as an array of objects.
const allRows = await db.getAllAsync('SELECT * FROM test');
for (const row of allRows) {
  console.log(row.id, row.value, row.intValue);
}

// `getEachAsync()` is useful when you want to iterate SQLite query cursor.
for await (const row of db.getEachAsync('SELECT * FROM test')) {
  console.log(row.id, row.value, row.intValue);
}

Show More
Prepared statements
Prepared statements allow you to compile your SQL query once and execute it multiple times with different parameters. They automatically escape input parameters to defend against SQL injection attacks, and are recommended for queries that include user input. You can get a prepared statement by calling prepareAsync() or prepareSync() method on a database instance. The prepared statement can fulfill CRUD operations by calling executeAsync() or executeSync() method.

Note: Remember to call finalizeAsync() or finalizeSync() method to release the prepared statement after you finish using the statement. try-finally block is recommended to ensure the prepared statement is finalized.

Prepared statements

Copy


const statement = await db.prepareAsync(
  'INSERT INTO test (value, intValue) VALUES ($value, $intValue)'
);
try {
  let result = await statement.executeAsync({ $value: 'bbb', $intValue: 101 });
  console.log('bbb and 101:', result.lastInsertRowId, result.changes);

  result = await statement.executeAsync({ $value: 'ccc', $intValue: 102 });
  console.log('ccc and 102:', result.lastInsertRowId, result.changes);

  result = await statement.executeAsync({ $value: 'ddd', $intValue: 103 });
  console.log('ddd and 103:', result.lastInsertRowId, result.changes);
} finally {
  await statement.finalizeAsync();
}

const statement2 = await db.prepareAsync('SELECT * FROM test WHERE intValue >= $intValue');
try {
  const result = await statement2.executeAsync<{ value: string; intValue: number }>({
    $intValue: 100,
  });

  // `getFirstAsync()` is useful when you want to get a single row from the database.
  const firstRow = await result.getFirstAsync();
  console.log(firstRow.id, firstRow.value, firstRow.intValue);

  // Reset the SQLite query cursor to the beginning for the next `getAllAsync()` call.
  await result.resetAsync();

  // `getAllAsync()` is useful when you want to get all results as an array of objects.
  const allRows = await result.getAllAsync();
  for (const row of allRows) {
    console.log(row.value, row.intValue);
  }

  // Reset the SQLite query cursor to the beginning for the next `for-await-of` loop.
  await result.resetAsync();

  // The result object is also an async iterable. You can use it in `for-await-of` loop to iterate SQLite query cursor.
  for await (const row of result) {
    console.log(row.value, row.intValue);
  }
} finally {
  await statement2.finalizeAsync();
}

Show More
useSQLiteContext() hook
useSQLiteContext() hook

Copy


import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <SQLiteProvider databaseName="test.db" onInit={migrateDbIfNeeded}>
        <Header />
        <Content />
      </SQLiteProvider>
    </View>
  );
}

export function Header() {
  const db = useSQLiteContext();
  const [version, setVersion] = useState('');
  useEffect(() => {
    async function setup() {
      const result = await db.getFirstAsync<{ 'sqlite_version()': string }>(
        'SELECT sqlite_version()'
      );
      setVersion(result['sqlite_version()']);
    }
    setup();
  }, []);
  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerText}>SQLite version: {version}</Text>
    </View>
  );
}

interface Todo {
  value: string;
  intValue: number;
}

export function Content() {
  const db = useSQLiteContext();
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    async function setup() {
      const result = await db.getAllAsync<Todo>('SELECT * FROM todos');
      setTodos(result);
    }
    setup();
  }, []);

  return (
    <View style={styles.contentContainer}>
      {todos.map((todo, index) => (
        <View style={styles.todoItemContainer} key={index}>
          <Text>{`${todo.intValue} - ${todo.value}`}</Text>
        </View>
      ))}
    </View>
  );
}

async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 1;
  let { user_version: currentDbVersion } = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }
  if (currentDbVersion === 0) {
    await db.execAsync(`
PRAGMA journal_mode = 'wal';
CREATE TABLE todos (id INTEGER PRIMARY KEY NOT NULL, value TEXT NOT NULL, intValue INTEGER);
`);
    await db.runAsync('INSERT INTO todos (value, intValue) VALUES (?, ?)', 'hello', 1);
    await db.runAsync('INSERT INTO todos (value, intValue) VALUES (?, ?)', 'world', 2);
    currentDbVersion = 1;
  }
  // if (currentDbVersion === 1) {
  //   Add more migrations
  // }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

const styles = StyleSheet.create({
  // Your styles...
});

Show More
useSQLiteContext() hook with React.Suspense
As with the useSQLiteContext() hook, you can also integrate the SQLiteProvider with React.Suspense to show a fallback component until the database is ready. To enable the integration, pass the useSuspense prop to the SQLiteProvider component.

useSQLiteContext() hook with React.Suspense

Copy


import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Suspense } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Suspense fallback={<Fallback />}>
        <SQLiteProvider databaseName="test.db" onInit={migrateDbIfNeeded} useSuspense>
          <Header />
          <Content />
        </SQLiteProvider>
      </Suspense>
    </View>
  );
}
Executing queries within an async transaction
Executing queries within an async transaction

Copy


const db = await SQLite.openDatabaseAsync('databaseName');

await db.withTransactionAsync(async () => {
  const result = await db.getFirstAsync('SELECT COUNT(*) FROM USERS');
  console.log('Count:', result.rows[0]['COUNT(*)']);
});
Due to the nature of async/await, any query that runs while the transaction is active will be included in the transaction. This includes query statements that are outside of the scope function passed to withTransactionAsync() and may be surprising behavior. For example, the following test case runs queries inside and outside of a scope function passed to withTransactionAsync(). However, all of the queries will run within the actual SQL transaction because the second UPDATE query runs before the transaction finishes.

Promise.all([
  // 1. A new transaction begins
  db.withTransactionAsync(async () => {
    // 2. The value "first" is inserted into the test table and we wait 2
    //    seconds
    await db.execAsync('INSERT INTO test (data) VALUES ("first")');
    await sleep(2000);

    // 4. Two seconds in, we read the latest data from the table
    const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM test');

    // ❌ The data in the table will be "second" and this expectation will fail.
    //    Additionally, this expectation will throw an error and roll back the
    //    transaction, including the `UPDATE` query below since it ran within
    //    the transaction.
    expect(row.data).toBe('first');
  }),
  // 3. One second in, the data in the test table is updated to be "second".
  //    This `UPDATE` query runs in the transaction even though its code is
  //    outside of it because the transaction happens to be active at the time
  //    this query runs.
  sleep(1000).then(async () => db.execAsync('UPDATE test SET data = "second"')),
]);

Show More
The withExclusiveTransactionAsync() function addresses this. Only queries that run within the scope function passed to withExclusiveTransactionAsync() will run within the actual SQL transaction.

Executing PRAGMA queries
Executing PRAGMA queries

Copy


const db = await SQLite.openDatabaseAsync('databaseName');
await db.execAsync('PRAGMA journal_mode = WAL');
await db.execAsync('PRAGMA foreign_keys = ON');
Tip: Enable WAL journal mode when you create a new database to improve performance in general.
Import an existing database
To open a new SQLite database using an existing .db file you already have, you can use the SQLiteProvider with assetSource.

useSQLiteContext() with existing database

Copy


import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <SQLiteProvider databaseName="test.db" assetSource={{ assetId: require('./assets/test.db') }}>
        <Header />
        <Content />
      </SQLiteProvider>
    </View>
  );
}
Sharing a database between apps/extensions (iOS)
To share a database with other apps/extensions in the same App Group, you can use shared containers by following the steps below:

1

Configure the App Group in app config:

app.json

Copy


{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.myapp",
      "entitlements": {
        "com.apple.security.application-groups": ["group.com.myapp"]
      }
    }
  }
}
2

Use Paths.appleSharedContainers from the expo-file-system library to retrieve the path to the shared container:

Using Shared Container for SQLite Database on iOS

Copy


import { SQLiteProvider, defaultDatabaseDirectory } from 'expo-sqlite';
import { Paths } from 'expo-file-system';
import { useMemo } from 'react';
import { Platform, View } from 'react-native';

export default function App() {
  const dbDirectory = useMemo(() => {
    if (Platform.OS === 'ios') {
      return Object.values(Paths.appleSharedContainers)?.[0]?.uri;
      // or `Paths.appleSharedContainers['group.com.myapp']?.uri` to choose specific container
    }
    return defaultDatabaseDirectory;
  }, []);

  return (
    <View style={styles.container}>
      <SQLiteProvider databaseName="test.db" directory={dbDirectory}>
        <Header />
        <Content />
      </SQLiteProvider>
    </View>
  );
}

Show More
Passing binary data
Use Uint8Array to pass binary data to the database:

Passing binary data

Copy


await db.execAsync(`
DROP TABLE IF EXISTS blobs;
CREATE TABLE IF NOT EXISTS blobs (id INTEGER PRIMARY KEY NOT NULL, data BLOB);
`);

const blob = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
await db.runAsync('INSERT INTO blobs (data) VALUES (?)', blob);

const row = await db.getFirstAsync<{ data: Uint8Array }>('SELECT * FROM blobs');
expect(row.data).toEqual(blob);
Browse an on-device database
You can inspect a database, execute queries against it, and explore data with the drizzle-studio-expo dev tools plugin. This plugin enables you to launch Drizzle Studio, connected to a database in your app, directly from Expo CLI. This plugin can be used with any expo-sqlite configuration. It does not require that you use Drizzle ORM in your app. Learn how to install and use the plugin.

Key-value storage
The expo-sqlite library provides Storage as a drop-in replacement for the @react-native-async-storage/async-storage library. This key-value store is backed by SQLite. If your project already uses expo-sqlite, you can leverage expo-sqlite/kv-store without needing to add another dependency.

Storage provides the same API as @react-native-async-storage/async-storage:

Using the Store

Copy


// The storage API is the default export, you can call it Storage, AsyncStorage, or whatever you prefer.
import Storage from 'expo-sqlite/kv-store';

await Storage.setItem('key', JSON.stringify({ entity: 'value' }));
const value = await Storage.getItem('key');
const entity = JSON.parse(value);
console.log(entity); // { entity: 'value' }
A key benefit of using expo-sqlite/kv-store is the addition of synchronous APIs for added convenience:

Using the Store with synchronous APIs

Copy


// The storage API is the default export, you can call it Storage, AsyncStorage, or whatever you prefer.
import Storage from 'expo-sqlite/kv-store';

Storage.setItemSync('key', 'value');
const value = Storage.getItemSync('key');
If you're currently using @react-native-async-storage/async-storage in your project, switching to expo-sqlite/kv-store is as simple as changing the import statement:

- import AsyncStorage from '@react-native-async-storage/async-storage';
+ import AsyncStorage from 'expo-sqlite/kv-store';
The localStorage API
The expo-sqlite/localStorage/install module provides a drop-in implementation for the localStorage API. If you're already familiar with this API from the web, or you would like to be able to share storage code between web and other platforms, this may be useful. To use it, you just need to import the expo-sqlite/localStorage/install module:

Note: import 'expo-sqlite/localStorage/install'; is a no-op on web and will be excluded from the production JS bundle.

Install globalThis.localStorage

Copy


import 'expo-sqlite/localStorage/install';

globalThis.localStorage.setItem('key', 'value');
console.log(globalThis.localStorage.getItem('key')); // 'value'
Security
SQL injections are a class of vulnerabilities where attackers trick your app into executing user input as SQL code. You must escape all user input passed to SQLite to defend against SQL injections. Prepared statements are an effective defense against this problem. They explicitly separate a SQL query's logic from its input parameters, and SQLite automatically escapes inputs when executing prepared statements.

Third-party library integrations
The expo-sqlite library is designed to be a solid SQLite foundation. It enables broader integrations with third-party libraries for more advanced higher-level features. Here are some of the libraries that you can use with expo-sqlite.

Drizzle ORM
Drizzle is a "headless TypeScript ORM with a head". It runs on Node.js, Bun, Deno, and React Native. It also has a CLI companion called drizzle-kit for generating SQL migrations.

Check out the Drizzle ORM documentation and the expo-sqlite integration guide for more details.

Knex.js
Knex.js is a SQL query builder that is "flexible, portable, and fun to use!"

Check out the expo-sqlite integration guide for more details.

SQLCipher
Note: SQLCipher is not supported on Expo Go.

SQLCipher is a fork of SQLite that adds encryption and authentication to the database. The expo-sqlite library supports SQLCipher for Android, iOS, and macOS. To use SQLCipher, you need to add the useSQLCipher config to your app.json as shown in the Configuration in app config section and run npx expo prebuild.

Right after you open a database, you need to set a password for the database using the PRAGMA key = 'password' statement.

Add a password to the database

Copy


const db = await SQLite.openDatabaseAsync('databaseName');
await db.execAsync(`PRAGMA key = 'password'`);
API
Cheatsheet for the common API
The following table summarizes the common API for SQLiteDatabase and SQLiteStatement classes:

SQLiteDatabase methods	SQLiteStatement methods	Description	Use Case
runAsync()	executeAsync()	Executes a SQL query, returning information on the changes made.	Ideal for SQL write operations such as INSERT, UPDATE, DELETE.
getFirstAsync()	executeAsync() + getFirstAsync()	Retrieves the first row from the query result.	Suitable for fetching a single row from the database. For example: getFirstAsync('SELECT * FROM Users WHERE id = ?', userId).
getAllAsync()	executeAsync() + getFirstAsync()	Fetches all query results at once.	Best suited for scenarios with smaller result sets, such as queries with a LIMIT clause, like SELECT * FROM Table LIMIT 100, where you intend to retrieve all results in a single batch.
getEachAsync()	executeAsync() + for-await-of async iterator	Provides an iterator for result set traversal. This method fetches one row at a time from the database, potentially reducing memory usage compared to getAllAsync().	Recommended for handling large result sets incrementally, such as with infinite scrolling implementations.
Component
SQLiteProvider
Type: React.Element<SQLiteProviderProps>

Context.Provider component that provides a SQLite database to all children. All descendants of this component will be able to access the database using the useSQLiteContext hook.

SQLiteProviderProps

assetSource
Optional • Type: SQLiteProviderAssetSource
Import a bundled database file from the specified asset module.

Example

assetSource={{ assetId: require('./assets/db.db') }}
children
Type: ReactNode
The children to render.

databaseName
Type: string
The name of the database file to open.

directory
Optional • Type: string • Default: defaultDatabaseDirectory
The directory where the database file is located.

onError
Optional • Type: (error: Error) => void • Default: rethrow the error
Handle errors from SQLiteProvider.

onInit
Optional • Type: (db: SQLiteDatabase) => Promise<void>
A custom initialization handler to run before rendering the children. You can use this to run database migrations or other setup tasks.

options
Optional • Type: SQLiteOpenOptions
Open options.

useSuspense
Optional • Type: boolean • Default: false
Enable React.Suspense integration.

Example

export default function App() {
  return (
    <Suspense fallback={<Text>Loading...</Text>}>
      <SQLiteProvider databaseName="test.db" useSuspense={true}>
        <Main />
      </SQLiteProvider>
    </Suspense>
  );
}
Constants
SQLite.AsyncStorage
Type: SQLiteStorage

This default instance of the SQLiteStorage class is used as a drop-in replacement for the AsyncStorage module from @react-native-async-storage/async-storage.

SQLite.bundledExtensions
Type: Record<string, { entryPoint: string, libPath: string } | undefined>

The pre-bundled SQLite extensions.

SQLite.defaultDatabaseDirectory
Type: any

The default directory for SQLite databases.

SQLite.Storage
Type: SQLiteStorage

Alias for AsyncStorage, given the storage not only offers asynchronous methods.

Hooks
useSQLiteContext()
A global hook for accessing the SQLite database across components. This hook should only be used within a <SQLiteProvider> component.

Returns:
SQLiteDatabase
Example

export default function App() {
  return (
    <SQLiteProvider databaseName="test.db">
      <Main />
    </SQLiteProvider>
  );
}

export function Main() {
  const db = useSQLiteContext();
  console.log('sqlite version', db.getFirstSync('SELECT sqlite_version()'));
  return <View />
}
Classes
SQLiteDatabase
A SQLite database.

SQLiteDatabase Properties

databasePath
Read Only • Type: string
nativeDatabase
Read Only • Type: NativeDatabase
options
Read Only • Type: SQLiteOpenOptions
SQLiteDatabase Methods

closeAsync()
Close the database.

Returns:
Promise<void>
closeSync()
Close the database.

Returns:
void
createSessionAsync(dbName)
Parameter	Type	Description
dbName
(optional)
string	
The name of the database to create a session for. The default value is main.

Default:
'main'

Create a new session for the database.

Returns:
Promise<SQLiteSession>
See: sqlite3session_create

createSessionSync(dbName)
Parameter	Type	Description
dbName
(optional)
string	
The name of the database to create a session for. The default value is main.

Default:
'main'

Create a new session for the database.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
SQLiteSession
See: sqlite3session_create

execAsync(source)
Parameter	Type	Description
source	string	
A string containing all the SQL queries.


Execute all SQL queries in the supplied string.

Note: The queries are not escaped for you! Be careful when constructing your queries.

Returns:
Promise<void>
execSync(source)
Parameter	Type	Description
source	string	
A string containing all the SQL queries.


Execute all SQL queries in the supplied string.

Note: The queries are not escaped for you! Be careful when constructing your queries.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
void
getAllAsync(source, params)
Parameter	Type	Description
source	string	
A string containing the SQL query.

params	SQLiteBindParams	
The parameters to bind to the prepared statement. You can pass values in array, object, or variadic arguments. See SQLiteBindValue for more information about binding values.


A convenience wrapper around SQLiteDatabase.prepareAsync(), SQLiteStatement.executeAsync(), SQLiteExecuteAsyncResult.getAllAsync(), and SQLiteStatement.finalizeAsync().

Returns:
Promise<T[]>
Example

// For unnamed parameters, you pass values in an array.
db.getAllAsync('SELECT * FROM test WHERE intValue = ? AND name = ?', [1, 'Hello']);

// For unnamed parameters, you pass values in variadic arguments.
db.getAllAsync('SELECT * FROM test WHERE intValue = ? AND name = ?', 1, 'Hello');

// For named parameters, you should pass values in object.
db.getAllAsync('SELECT * FROM test WHERE intValue = $intValue AND name = $name', { $intValue: 1, $name: 'Hello' });
getAllSync(source, params)
Parameter	Type	Description
source	string	
A string containing the SQL query.

params	SQLiteBindParams	
The parameters to bind to the prepared statement. You can pass values in array, object, or variadic arguments. See SQLiteBindValue for more information about binding values.


A convenience wrapper around SQLiteDatabase.prepareSync(), SQLiteStatement.executeSync(), SQLiteExecuteSyncResult.getAllSync(), and SQLiteStatement.finalizeSync().

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
T[]
getEachAsync(source, params)
Parameter	Type	Description
source	string	
A string containing the SQL query.

params	SQLiteBindParams	
The parameters to bind to the prepared statement. You can pass values in array, object, or variadic arguments. See SQLiteBindValue for more information about binding values.


A convenience wrapper around SQLiteDatabase.prepareAsync(), SQLiteStatement.executeAsync(), SQLiteExecuteAsyncResult AsyncIterator, and SQLiteStatement.finalizeAsync().

Returns:
AsyncIterableIterator<T>
Rather than returning Promise, this function returns an AsyncIterableIterator. You can use for await...of to iterate over the rows from the SQLite query result.

getEachSync(source, params)
Parameter	Type	Description
source	string	
A string containing the SQL query.

params	SQLiteBindParams	
The parameters to bind to the prepared statement. You can pass values in array, object, or variadic arguments. See SQLiteBindValue for more information about binding values.


A convenience wrapper around SQLiteDatabase.prepareSync(), SQLiteStatement.executeSync(), SQLiteExecuteSyncResult Iterator, and SQLiteStatement.finalizeSync().

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
IterableIterator<T>
This function returns an IterableIterator. You can use for...of to iterate over the rows from the SQLite query result.

getFirstAsync(source, params)
Parameter	Type	Description
source	string	
A string containing the SQL query.

params	SQLiteBindParams	
The parameters to bind to the prepared statement. You can pass values in array, object, or variadic arguments. See SQLiteBindValue for more information about binding values.


A convenience wrapper around SQLiteDatabase.prepareAsync(), SQLiteStatement.executeAsync(), SQLiteExecuteAsyncResult.getFirstAsync(), and SQLiteStatement.finalizeAsync().

Returns:
Promise<null | T>
getFirstSync(source, params)
Parameter	Type	Description
source	string	
A string containing the SQL query.

params	SQLiteBindParams	
The parameters to bind to the prepared statement. You can pass values in array, object, or variadic arguments. See SQLiteBindValue for more information about binding values.


A convenience wrapper around SQLiteDatabase.prepareSync(), SQLiteStatement.executeSync(), SQLiteExecuteSyncResult.getFirstSync(), and SQLiteStatement.finalizeSync().

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
null | T
isInTransactionAsync()
Asynchronous call to return whether the database is currently in a transaction.

Returns:
Promise<boolean>
isInTransactionSync()
Synchronous call to return whether the database is currently in a transaction.

Returns:
boolean
loadExtensionAsync(libPath, entryPoint)
Parameter	Type	Description
libPath	string	
The path to the extension library file.

entryPoint
(optional)
string	
The entry point of the extension. If not provided, the default entry point is inferred by sqlite3_load_extension.


Load a SQLite extension.

Returns:
Promise<void>
Example

// Load `sqlite-vec` from `bundledExtensions`. You need to enable `withSQLiteVecExtension` to include `sqlite-vec`.
const extension = SQLite.bundledExtensions['sqlite-vec'];
await db.loadExtensionAsync(extension.libPath, extension.entryPoint);

// You can also load a custom extension.
await db.loadExtensionAsync('/path/to/extension');
loadExtensionSync(libPath, entryPoint)
Parameter	Type	Description
libPath	string	
The path to the extension library file.

entryPoint
(optional)
string	
The entry point of the extension. If not provided, the default entry point is inferred by sqlite3_load_extension.


Load a SQLite extension.

Returns:
void
Example

// Load `sqlite-vec` from `bundledExtensions`. You need to enable `withSQLiteVecExtension` to include `sqlite-vec`.
const extension = SQLite.bundledExtensions['sqlite-vec'];
db.loadExtensionSync(extension.libPath, extension.entryPoint);

// You can also load a custom extension.
db.loadExtensionSync('/path/to/extension');
prepareAsync(source)
Parameter	Type	Description
source	string	
A string containing the SQL query.


Create a prepared SQLite statement.

Returns:
Promise<SQLiteStatement>
prepareSync(source)
Parameter	Type	Description
source	string	
A string containing the SQL query.


Create a prepared SQLite statement.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
SQLiteStatement
runAsync(source, params)
Parameter	Type	Description
source	string	
A string containing the SQL query.

params	SQLiteBindParams	
The parameters to bind to the prepared statement. You can pass values in array, object, or variadic arguments. See SQLiteBindValue for more information about binding values.


A convenience wrapper around SQLiteDatabase.prepareAsync(), SQLiteStatement.executeAsync(), and SQLiteStatement.finalizeAsync().

Returns:
Promise<SQLiteRunResult>
runSync(source, params)
Parameter	Type	Description
source	string	
A string containing the SQL query.

params	SQLiteBindParams	
The parameters to bind to the prepared statement. You can pass values in array, object, or variadic arguments. See SQLiteBindValue for more information about binding values.


A convenience wrapper around SQLiteDatabase.prepareSync(), SQLiteStatement.executeSync(), and SQLiteStatement.finalizeSync().

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
SQLiteRunResult
serializeAsync(databaseName)
Parameter	Type	Description
databaseName
(optional)
string	
The name of the current attached databases. The default value is main which is the default database name.

Default:
'main'

Serialize the database as Uint8Array.

Returns:
Promise<Uint8Array>
serializeSync(databaseName)
Parameter	Type	Description
databaseName
(optional)
string	
The name of the current attached databases. The default value is main which is the default database name.

Default:
'main'

Serialize the database as Uint8Array.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
Uint8Array
syncLibSQL()
Synchronize the local database with the remote libSQL server. This method is only available from libSQL integration.

Returns:
Promise<void>
withExclusiveTransactionAsync(task)
Parameter	Type	Description
task	(txn: Transaction) => Promise<void>	
An async function to execute within a transaction. Any queries inside the transaction must be executed on the txn object. The txn object has the same interfaces as the SQLiteDatabase object. You can use txn like a SQLiteDatabase object.


Execute a transaction and automatically commit/rollback based on the task result.

The transaction may be exclusive. As long as the transaction is converted into a write transaction, the other async write queries will abort with database is locked error.

Note: This function is not supported on web.

Returns:
Promise<void>
Example

db.withExclusiveTransactionAsync(async (txn) => {
  await txn.execAsync('UPDATE test SET name = "aaa"');
});
withTransactionAsync(task)
Parameter	Type	Description
task	() => Promise<void>	
An async function to execute within a transaction.


Execute a transaction and automatically commit/rollback based on the task result.

Note: This transaction is not exclusive and can be interrupted by other async queries.

Returns:
Promise<void>
Example

db.withTransactionAsync(async () => {
  await db.execAsync('UPDATE test SET name = "aaa"');

  //
  // We cannot control the order of async/await order, so order of execution is not guaranteed.
  // The following UPDATE query out of transaction may be executed here and break the expectation.
  //

  const result = await db.getFirstAsync<{ name: string }>('SELECT name FROM Users');
  expect(result?.name).toBe('aaa');
});
db.execAsync('UPDATE test SET name = "bbb"');
If you worry about the order of execution, use withExclusiveTransactionAsync instead.

withTransactionSync(task)
Parameter	Type	Description
task	() => void	
An async function to execute within a transaction.


Execute a transaction and automatically commit/rollback based on the task result.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
void
SQLiteSession
A class that represents an instance of the SQLite session extension.

See: Session Extension

SQLiteSession Methods

applyChangesetAsync(changeset)
Parameter	Type	Description
changeset	Changeset	
The changeset to apply.


Apply a changeset asynchronously.

Returns:
Promise<void>
See: sqlite3changeset_apply

applyChangesetSync(changeset)
Parameter	Type	Description
changeset	Changeset	
The changeset to apply.


Apply a changeset synchronously.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
void
See: sqlite3changeset_apply

attachAsync(table)
Parameter	Type	Description
table	null | string	
The table to attach. If null, all tables are attached.


Attach a table to the session asynchronously.

Returns:
Promise<void>
See: sqlite3session_attach

attachSync(table)
Parameter	Type	Description
table	null | string	
The table to attach.


Attach a table to the session synchronously.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
void
See: sqlite3session_attach

closeAsync()
Close the session asynchronously.

Returns:
Promise<void>
See: sqlite3session_delete

closeSync()
Close the session synchronously.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
void
See: sqlite3session_delete

createChangesetAsync()
Create a changeset asynchronously.

Returns:
Promise<Changeset>
See: sqlite3session_changeset

createChangesetSync()
Create a changeset synchronously.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
Changeset
See: sqlite3session_changeset

createInvertedChangesetAsync()
Create an inverted changeset asynchronously. This is a shorthand for createChangesetAsync() + invertChangesetAsync().

Returns:
Promise<Changeset>
createInvertedChangesetSync()
Create an inverted changeset synchronously. This is a shorthand for createChangesetSync() + invertChangesetSync().

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
Changeset
enableAsync(enabled)
Parameter	Type	Description
enabled	boolean	
Whether to enable or disable the session.


Enable or disable the session asynchronously.

Returns:
Promise<void>
See: sqlite3session_enable

enableSync(enabled)
Parameter	Type	Description
enabled	boolean	
Whether to enable or disable the session.


Enable or disable the session synchronously.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
void
See: sqlite3session_enable

invertChangesetAsync(changeset)
Parameter	Type	Description
changeset	Changeset	
The changeset to invert.


Invert a changeset asynchronously.

Returns:
Promise<Changeset>
See: sqlite3changeset_invert

invertChangesetSync(changeset)
Parameter	Type	Description
changeset	Changeset	
The changeset to invert.


Invert a changeset synchronously.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
Changeset
See: sqlite3changeset_invert

SQLiteStatement
A prepared statement returned by SQLiteDatabase.prepareAsync() or SQLiteDatabase.prepareSync() that can be binded with parameters and executed.

SQLiteStatement Methods

executeAsync(params)
Parameter	Type	Description
params	SQLiteBindParams	
The parameters to bind to the prepared statement. You can pass values in array, object, or variadic arguments. See SQLiteBindValue for more information about binding values.


Run the prepared statement and return the SQLiteExecuteAsyncResult instance.

Returns:
Promise<SQLiteExecuteAsyncResult<T>>
executeSync(params)
Parameter	Type	Description
params	SQLiteBindParams	
The parameters to bind to the prepared statement. You can pass values in array, object, or variadic arguments. See SQLiteBindValue for more information about binding values.


Run the prepared statement and return the SQLiteExecuteSyncResult instance.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
SQLiteExecuteSyncResult<T>
finalizeAsync()
Finalize the prepared statement. This will call the sqlite3_finalize() C function under the hood.

Attempting to access a finalized statement will result in an error.

Note: While expo-sqlite will automatically finalize any orphaned prepared statements upon closing the database, it is considered best practice to manually finalize prepared statements as soon as they are no longer needed. This helps to prevent resource leaks. You can use the try...finally statement to ensure that prepared statements are finalized even if an error occurs.

Returns:
Promise<void>
finalizeSync()
Finalize the prepared statement. This will call the sqlite3_finalize() C function under the hood.

Attempting to access a finalized statement will result in an error.

Note: While expo-sqlite will automatically finalize any orphaned prepared statements upon closing the database, it is considered best practice to manually finalize prepared statements as soon as they are no longer needed. This helps to prevent resource leaks. You can use the try...finally statement to ensure that prepared statements are finalized even if an error occurs.

Returns:
void
getColumnNamesAsync()
Get the column names of the prepared statement.

Returns:
Promise<string[]>
getColumnNamesSync()
Get the column names of the prepared statement.

Returns:
string[]
SQLiteStorage
Key-value store backed by SQLite. This class accepts a databaseName parameter in its constructor, which is the name of the database file to use for the storage.

SQLiteStorage Methods

clear()
Alias for clearAsync() method.

Returns:
Promise<void>
clearAsync()
Clears all key-value pairs from the storage asynchronously.

Returns:
Promise<boolean>
clearSync()
Clears all key-value pairs from the storage synchronously.

Returns:
boolean
close()
Alias for closeAsync() method.

Returns:
Promise<void>
closeAsync()
Closes the database connection asynchronously.

Returns:
Promise<void>
closeSync()
Closes the database connection synchronously.

Returns:
void
getAllKeys()
Alias for getAllKeysAsync() method.

Returns:
Promise<string[]>
getAllKeysAsync()
Retrieves all keys stored in the storage asynchronously.

Returns:
Promise<string[]>
getAllKeysSync()
Retrieves all keys stored in the storage synchronously.

Returns:
string[]
getItem(key)
Parameter	Type
key	string

Alias for getItemAsync() method.

Returns:
Promise<null | string>
getItemAsync(key)
Parameter	Type
key	string

Retrieves the value associated with the given key asynchronously.

Returns:
Promise<null | string>
getItemSync(key)
Parameter	Type
key	string

Retrieves the value associated with the given key synchronously.

Returns:
null | string
getKeyByIndexAsync(index)
Parameter	Type
index	number

Retrieves the key at the given index asynchronously.

Returns:
Promise<null | string>
getKeyByIndexSync(index)
Parameter	Type
index	number

Retrieves the key at the given index synchronously.

Returns:
null | string
getLengthAsync()
Retrieves the number of key-value pairs stored in the storage asynchronously.

Returns:
Promise<number>
getLengthSync()
Retrieves the number of key-value pairs stored in the storage synchronously.

Returns:
number
mergeItem(key, value)
Parameter	Type
key	string
value	string

Merges the given value with the existing value for the given key asynchronously. If the existing value is a JSON object, performs a deep merge.

Returns:
Promise<void>
multiGet(keys)
Parameter	Type
keys	string[]

Retrieves the values associated with the given keys asynchronously.

Returns:
Promise<undefined>
multiMerge(keyValuePairs)
Parameter	Type
keyValuePairs	undefined

Merges multiple key-value pairs asynchronously. If existing values are JSON objects, performs a deep merge.

Returns:
Promise<void>
multiRemove(keys)
Parameter	Type
keys	string[]

Removes the values associated with the given keys asynchronously.

Returns:
Promise<void>
multiSet(keyValuePairs)
Parameter	Type
keyValuePairs	undefined

Sets multiple key-value pairs asynchronously.

Returns:
Promise<void>
removeItem(key)
Parameter	Type
key	string

Alias for removeItemAsync() method.

Returns:
Promise<void>
removeItemAsync(key)
Parameter	Type
key	string

Removes the value associated with the given key asynchronously.

Returns:
Promise<boolean>
removeItemSync(key)
Parameter	Type
key	string

Removes the value associated with the given key synchronously.

Returns:
boolean
setItem(key, value)
Parameter	Type
key	string
value	string | SQLiteStorageSetItemUpdateFunction

Alias for setItemAsync().

Returns:
Promise<void>
setItemAsync(key, value)
Parameter	Type
key	string
value	string | SQLiteStorageSetItemUpdateFunction

Sets the value for the given key asynchronously. If a function is provided, it computes the new value based on the previous value.

Returns:
Promise<void>
setItemSync(key, value)
Parameter	Type
key	string
value	string | SQLiteStorageSetItemUpdateFunction

Sets the value for the given key synchronously. If a function is provided, it computes the new value based on the previous value.

Returns:
void
Methods
SQLite.backupDatabaseAsync(options)
Parameter	Type	Description
options	
{
  destDatabase: SQLiteDatabase, 
  destDatabaseName: string, 
  sourceDatabase: SQLiteDatabase, 
  sourceDatabaseName: string
}
The backup options


Backup a database to another database.

Returns:
Promise<void>
See: https://www.sqlite.org/c3ref/backup_finish.html

SQLite.backupDatabaseSync(options)
Parameter	Type	Description
options	
{
  destDatabase: SQLiteDatabase, 
  destDatabaseName: string, 
  sourceDatabase: SQLiteDatabase, 
  sourceDatabaseName: string
}
The backup options


Backup a database to another database.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
void
See: https://www.sqlite.org/c3ref/backup_finish.html

SQLite.deepEqual(a, b)
Parameter	Type
a	
undefined | undefined
b	
undefined | undefined

Compares two objects deeply for equality.

Returns:
boolean
SQLite.deleteDatabaseAsync(databaseName, directory)
Parameter	Type	Description
databaseName	string	
The name of the database file to delete.

directory
(optional)
string	
The directory where the database file is located. The default value is defaultDatabaseDirectory.


Delete a database file.

Returns:
Promise<void>
SQLite.deleteDatabaseSync(databaseName, directory)
Parameter	Type	Description
databaseName	string	
The name of the database file to delete.

directory
(optional)
string	
The directory where the database file is located. The default value is defaultDatabaseDirectory.


Delete a database file.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
void
SQLite.deserializeDatabaseAsync(serializedData, options)
Parameter	Type	Description
serializedData	Uint8Array	
The binary array to deserialize from SQLiteDatabase.serializeAsync().

options
(optional)
SQLiteOpenOptions	
Open options.


Given a Uint8Array data and deserialize to memory database.

Returns:
Promise<SQLiteDatabase>
SQLite.deserializeDatabaseSync(serializedData, options)
Parameter	Type	Description
serializedData	Uint8Array	
The binary array to deserialize from SQLiteDatabase.serializeSync()

options
(optional)
SQLiteOpenOptions	
Open options.


Given a Uint8Array data and deserialize to memory database.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
SQLiteDatabase
SQLite.openDatabaseAsync(databaseName, options, directory)
Parameter	Type	Description
databaseName	string	
The name of the database file to open.

options
(optional)
SQLiteOpenOptions	
Open options.

directory
(optional)
string	
The directory where the database file is located. The default value is defaultDatabaseDirectory. This parameter is not supported on web.


Open a database.

Returns:
Promise<SQLiteDatabase>
SQLite.openDatabaseSync(databaseName, options, directory)
Parameter	Type	Description
databaseName	string	
The name of the database file to open.

options
(optional)
SQLiteOpenOptions	
Open options.

directory
(optional)
string	
The directory where the database file is located. The default value is defaultDatabaseDirectory. This parameter is not supported on web.


Open a database.

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Returns:
SQLiteDatabase
Event Subscriptions
SQLite.addDatabaseChangeListener(listener)
Parameter	Type	Description
listener	(event: DatabaseChangeEvent) => void	
A function that receives the databaseName, databaseFilePath, tableName and rowId of the modified data.


Add a listener for database changes.

Note: to enable this feature, you must set enableChangeListener to true when opening the database.

Returns:
EventSubscription
A Subscription object that you can call remove() on when you would like to unsubscribe the listener.

Interfaces
SQLiteExecuteAsyncResult
Extends: AsyncIterableIterator<T>

A result returned by SQLiteStatement.executeAsync().

Example

The result includes the lastInsertRowId and changes properties. You can get the information from the write operations.

const statement = await db.prepareAsync('INSERT INTO test (value) VALUES (?)');
try {
  const result = await statement.executeAsync(101);
  console.log('lastInsertRowId:', result.lastInsertRowId);
  console.log('changes:', result.changes);
} finally {
  await statement.finalizeAsync();
}
Example

The result implements the AsyncIterator interface, so you can use it in for await...of loops.

const statement = await db.prepareAsync('SELECT value FROM test WHERE value > ?');
try {
  const result = await statement.executeAsync<{ value: number }>(100);
  for await (const row of result) {
    console.log('row value:', row.value);
  }
} finally {
  await statement.finalizeAsync();
}
Example

If your write operations also return values, you can mix all of them together.

const statement = await db.prepareAsync('INSERT INTO test (name, value) VALUES (?, ?) RETURNING name');
try {
  const result = await statement.executeAsync<{ name: string }>('John Doe', 101);
  console.log('lastInsertRowId:', result.lastInsertRowId);
  console.log('changes:', result.changes);
  for await (const row of result) {
    console.log('name:', row.name);
  }
} finally {
  await statement.finalizeAsync();
}
Property	Type	Description
changes	number	
The number of rows affected. Returned from the sqlite3_changes() function.

lastInsertRowId	number	
The last inserted row ID. Returned from the sqlite3_last_insert_rowid() function.

SQLiteExecuteAsyncResult Methods

getAllAsync()
Get all rows of the result set. This requires the SQLite cursor to be in its initial state. If you have already retrieved rows from the result set, you need to reset the cursor first by calling resetAsync(). Otherwise, an error will be thrown.

Returns:
Promise<T[]>
getFirstAsync()
Get the first row of the result set. This requires the SQLite cursor to be in its initial state. If you have already retrieved rows from the result set, you need to reset the cursor first by calling resetAsync(). Otherwise, an error will be thrown.

Returns:
Promise<null | T>
resetAsync()
Reset the prepared statement cursor. This will call the sqlite3_reset() C function under the hood.

Returns:
Promise<void>
SQLiteExecuteSyncResult
Extends: IterableIterator<T>

A result returned by SQLiteStatement.executeSync().

Note: Running heavy tasks with this function can block the JavaScript thread and affect performance.

Example

The result includes the lastInsertRowId and changes properties. You can get the information from the write operations.

const statement = db.prepareSync('INSERT INTO test (value) VALUES (?)');
try {
  const result = statement.executeSync(101);
  console.log('lastInsertRowId:', result.lastInsertRowId);
  console.log('changes:', result.changes);
} finally {
  statement.finalizeSync();
}
Example

The result implements the Iterator interface, so you can use it in for...of loops.

const statement = db.prepareSync('SELECT value FROM test WHERE value > ?');
try {
  const result = statement.executeSync<{ value: number }>(100);
  for (const row of result) {
    console.log('row value:', row.value);
  }
} finally {
  statement.finalizeSync();
}
Example

If your write operations also return values, you can mix all of them together.

const statement = db.prepareSync('INSERT INTO test (name, value) VALUES (?, ?) RETURNING name');
try {
  const result = statement.executeSync<{ name: string }>('John Doe', 101);
  console.log('lastInsertRowId:', result.lastInsertRowId);
  console.log('changes:', result.changes);
  for (const row of result) {
    console.log('name:', row.name);
  }
} finally {
  statement.finalizeSync();
}
Property	Type	Description
changes	number	
The number of rows affected. Returned from the sqlite3_changes() function.

lastInsertRowId	number	
The last inserted row ID. Returned from the sqlite3_last_insert_rowid() function.

SQLiteExecuteSyncResult Methods

getAllSync()
Get all rows of the result set. This requires the SQLite cursor to be in its initial state. If you have already retrieved rows from the result set, you need to reset the cursor first by calling resetSync(). Otherwise, an error will be thrown.

Returns:
T[]
getFirstSync()
Get the first row of the result set. This requires the SQLite cursor to be in its initial state. If you have already retrieved rows from the result set, you need to reset the cursor first by calling resetSync(). Otherwise, an error will be thrown.

Returns:
null | T
resetSync()
Reset the prepared statement cursor. This will call the sqlite3_reset() C function under the hood.

Returns:
void
SQLiteOpenOptions
Options for opening a database.

Property	Type	Description
enableChangeListener
(optional)
boolean	
Whether to call the sqlite3_update_hook() function and enable the onDatabaseChange events. You can later subscribe to the change events by addDatabaseChangeListener.

Default:
false
libSQLOptions
(optional)
{
  authToken: string, 
  remoteOnly: boolean, 
  url: string
}
Options for libSQL integration.

useNewConnection
(optional)
boolean	
Whether to create new connection even if connection with the same database name exists in cache.

Default:
false
SQLiteProviderAssetSource
Property	Type	Description
assetId	number	
The asset ID returned from the require() call.

forceOverwrite
(optional)
boolean	
Force overwrite the local database file even if it already exists.

Default:
false
SQLiteRunResult
A result returned by SQLiteDatabase.runAsync or SQLiteDatabase.runSync.

Property	Type	Description
changes	number	
The number of rows affected. Returned from the sqlite3_changes() function.

lastInsertRowId	number	
The last inserted row ID. Returned from the sqlite3_last_insert_rowid() function.

Types
Changeset
Type: Uint8Array

A type that represents a changeset.

DatabaseChangeEvent
The event payload for the listener of addDatabaseChangeListener

Property	Type	Description
databaseFilePath	string	
The absolute file path to the database.

databaseName	string	
The database name. The value would be main by default and other database names if you use ATTACH DATABASE statement.

rowId	number	
The changed row ID.

tableName	string	
The table name.

SQLiteBindParams
Literal Type: Record

Acceptable values are: Record<string, SQLiteBindValue>

SQLiteBindValue
Literal Type: union

Bind parameters to the prepared statement. You can either pass the parameters in the following forms:

Example

A single array for unnamed parameters.

const statement = await db.prepareAsync('SELECT * FROM test WHERE value = ? AND intValue = ?');
const result = await statement.executeAsync(['test1', 789]);
const firstRow = await result.getFirstAsync();
Example

Variadic arguments for unnamed parameters.

const statement = await db.prepareAsync('SELECT * FROM test WHERE value = ? AND intValue = ?');
const result = await statement.executeAsync('test1', 789);
const firstRow = await result.getFirstAsync();
Example

A single object for named parameters

We support multiple named parameter forms such as :VVV, @VVV, and $VVV. We recommend using $VVV because JavaScript allows using $ in identifiers without escaping.

const statement = await db.prepareAsync('SELECT * FROM test WHERE value = $value AND intValue = $intValue');
const result = await statement.executeAsync({ $value: 'test1', $intValue: 789 });
const firstRow = await result.getFirstAsync();
Acceptable values are: string | number | null | boolean | Uint8Array

SQLiteStorageSetItemUpdateFunction(prevValue)
Update function for the setItemAsync() or setItemSync() method. It computes the new value based on the previous value. The function returns the new value to set for the key.

Parameter	Type	Description
prevValue	string | null	
The previous value associated with the key, or null if the key was not set.

Returns:
string

SQLiteVariadicBindParams
Type: SQLiteBindValue[]

Previous (Expo SDK)

SplashScreen

Next (Expo SDK)

StatusBar