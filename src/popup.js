const trackers = [
  {
    name: "Google Analytics",
    description: "Fill",
    status: "Healthy",
  },
  {
    name: "Google Ads",
    description: "Fill",
    status: "Healthy"
  },
  {
    name: "Hubspot",
    description: "Fill",
    status: "Healthy"
  },
  {
    name: "Clarity",
    description: "Fill",
    status: "Missing"
  },
  {
    name: "Meta",
    description: "Fill",
    status: "Missing"
  }
];

const statuscolors = {
    Healthy: {
        dot: "#00FF00",
        text: "Sending events normally"
    },
    Error: {
        dot: "#FF0000",
        text: "Error"
    },
    Missing: {
        dot: "#7f7e7e",
        text: "Not Detected"
    }
};
