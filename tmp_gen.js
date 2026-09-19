const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function main() {
  // Start
  let count = 3;
  let sum = 0;
  for (let i = 1; i <= 3; i += 1) {
    sum = sum + i;
    if (i > 1) {
      await sleep(300);
      const response = await fetch("https://jsonplaceholder.typicode.com/todos/1", {
        method: "GET",
        headers: { 'Content-Type': 'application/json' },
      });
      const apiData = await response.json();
      console.log(apiData);
    } else {
      console.log(sum);
    }
  }
  while (count > 0) {
    count = count - 1;
  }
}

main().catch((error) => {
  console.error(error)
})