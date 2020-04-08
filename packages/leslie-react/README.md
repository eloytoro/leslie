# leslie-react

Use the power of [leslie](https://www.npmjs.com/package/leslie) in react with hooks.

## Example

```js
function* StocksTable() {
  const [stocks, setStocks] = useState([]);
  const [date, setDate] = useState(Date.now());

  // Periodically fetch most recent info every second, will automatically cancel
  // if the component unmounts or the dependencies of the hook change
  useLatest(function* () {
    while (true) {
      const data = yield fetchStocks(date);
      setStocks(data);
      yield delay(1000);
    }
  }, [setStocks, date]);

  return (
    <Table>{stocks}</Table>
  );
}
```

In this example two things stand out:

* `while(true)`: This job runs periodically and only when the component is mounted, so it's safe to run infinite loops.
* `[setStocks, date]`: This hook depends on the `date` variable, which means if it changes it will stop running the job and restart it with the new values.

## API

### `useLatest(generatorFn, dependencies)` `useLatestLazy(generatorFn, dependencies): Function`

### `useChannel(generatorFn, dependencies)` `useChannelLazy(generatorFn, dependencies): Function`

### `useEvery(generatorFn, dependencies)` `useEveryLazy(generatorFn, dependencies): Function`

See the [leslie API](https://www.npmjs.com/package/leslie#api) for specifics on how these control flow functions work
