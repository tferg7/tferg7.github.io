let transactions = [];
let myChart;

// On GitHub Pages there is no server, so the app runs as a demo that keeps
// transactions in this browser's localStorage instead of MongoDB.
const DEMO_MODE = location.hostname.endsWith("github.io");
const DEMO_KEY = "budget-demo-transactions";

const demoStore = {
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
      if (Array.isArray(saved)) return saved;
    } catch (e) {
      // storage unavailable; fall back to sample data
    }
    // a few sample transactions so the chart isn't empty on first visit
    const day = 24 * 60 * 60 * 1000;
    return [
      { name: "Groceries", value: -86.4, date: new Date(Date.now() - 1 * day).toISOString() },
      { name: "Freelance project", value: 450, date: new Date(Date.now() - 3 * day).toISOString() },
      { name: "Utilities", value: -120.25, date: new Date(Date.now() - 6 * day).toISOString() },
      { name: "Paycheck", value: 1500, date: new Date(Date.now() - 8 * day).toISOString() },
    ];
  },
  save(list) {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(list));
    } catch (e) {
      // storage unavailable; changes last until the page is closed
    }
  },
};

if (DEMO_MODE) {
  const banner = document.getElementById("demo-banner");
  if (banner) banner.hidden = false;
}

(DEMO_MODE ? Promise.resolve(demoStore.load()) : fetch("/api/transaction").then(response => response.json()))
  .then(data => {
    // save db data on global variable
    transactions = Array.isArray(data) ? data : [];

    populateTotal();
    populateTable();
    populateChart();
  })
  .catch(err => {
    // offline with nothing cached yet
    console.log("Could not load transactions", err);
  });

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseFloat(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total.toFixed(2);
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    // textContent so a transaction name can't inject HTML
    let tr = document.createElement("tr");
    let nameTd = document.createElement("td");
    let valueTd = document.createElement("td");
    nameTd.textContent = transaction.name;
    valueTd.textContent = Number(transaction.value).toFixed(2);
    tr.append(nameTd, valueTd);

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseFloat(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: parseFloat(amountEl.value),
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  // demo mode: keep everything in this browser
  if (DEMO_MODE) {
    demoStore.save(transactions);
    nameEl.value = "";
    amountEl.value = "";
    return;
  }

  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db
    saveRecord(transaction);

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};
