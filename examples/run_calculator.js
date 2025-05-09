#!/usr/bin/env node

// Simple wrapper for the calculator grammar

const fs = require('fs');
const path = require('path');

// Get the input file from command line arguments
const inputFile = process.argv[2];

if (!inputFile) {
  console.error('Please provide an input file. Usage: node run_calculator.js <input-file>');
  process.exit(1);
}

// Load the enhanced parser wrapper (instead of directly using calculator.js)
const Parser = require('./calculator_wrapper.js');

// Read the input file
try {
  const input = fs.readFileSync(path.resolve(inputFile), 'utf8').trim();
  
  // Parse the input with the enhanced calculator object
  const result = Parser.parse(input);
  
  // Output the result
  console.log(result);
} catch (err) {
  console.error('Error from wrapper:', err.message);
  if (err.stack) {
      console.error(err.stack);
  }
  process.exit(1);
} 