#!/usr/bin/env node

/**
 * Randomness Test Script for 50/50 Draw
 *
 * Tests the Fisher-Yates shuffle + random selection approach
 * to verify uniform distribution across participants.
 *
 * Usage: node test-randomness.js
 */

/**
 * Fisher-Yates shuffle - EXACT COPY from Code.gs:49-56
 */
function shuffle(array) {
  const shuffled = array.slice(); // Create a copy to avoid modifying original
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Simulates the draw selection process - EXACT COPY from Code.gs:155-160
 * (This is the core randomization logic from conductDraw function)
 */
function conductSimulatedDraw(eligibleParticipants) {
  // Shuffle eligible participants to eliminate any position bias
  const shuffledParticipants = shuffle(eligibleParticipants);

  // Select random winner from shuffled array
  const randomIndex = Math.floor(Math.random() * shuffledParticipants.length);
  const winner = shuffledParticipants[randomIndex];

  return winner;
}

/**
 * Run the test for a specific number of draws
 */
function runTestForSampleSize(participants, numDraws) {
  const winCounts = new Array(participants.length).fill(0);

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`SAMPLE SIZE: ${numDraws.toLocaleString()} draws`);
  console.log('═'.repeat(70) + '\n');

  // Run simulated draws
  for (let i = 0; i < numDraws; i++) {
    const winner = conductSimulatedDraw(participants);
    winCounts[winner.id - 1]++;
  }

  // Calculate statistics
  const expectedWins = numDraws / participants.length;
  const expectedPercentage = (1 / participants.length) * 100;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Show all participants if 20 or fewer, otherwise show summary
  if (participants.length <= 20) {
    participants.forEach((participant, index) => {
      const wins = winCounts[index];
      const percentage = (wins / numDraws) * 100;
      const deviation = ((wins - expectedWins) / expectedWins) * 100;
      const deviationStr = deviation >= 0 ? `+${deviation.toFixed(2)}%` : `${deviation.toFixed(2)}%`;

      const bar = '█'.repeat(Math.round(percentage));

      console.log(`Participant ${participant.id.toString().padStart(3)}:  ${wins.toString().padStart(5)} wins  (${percentage.toFixed(2)}%)  ${deviationStr.padStart(8)}  ${bar}`);
    });
  } else {
    // Show summary statistics for large participant pools
    console.log('(Showing summary for large participant pool - individual results omitted)\n');

    // Show top 5 and bottom 5
    const participantsWithWins = participants.map((p, i) => ({
      id: p.id,
      wins: winCounts[i],
      percentage: (winCounts[i] / numDraws) * 100,
      deviation: ((winCounts[i] - expectedWins) / expectedWins) * 100
    })).sort((a, b) => b.wins - a.wins);

    console.log('Top 5 participants:');
    participantsWithWins.slice(0, 5).forEach(p => {
      const deviationStr = p.deviation >= 0 ? `+${p.deviation.toFixed(2)}%` : `${p.deviation.toFixed(2)}%`;
      console.log(`  Participant ${p.id.toString().padStart(3)}:  ${p.wins.toString().padStart(5)} wins  (${p.percentage.toFixed(2)}%)  ${deviationStr.padStart(8)}`);
    });

    console.log('\nBottom 5 participants:');
    participantsWithWins.slice(-5).reverse().forEach(p => {
      const deviationStr = p.deviation >= 0 ? `+${p.deviation.toFixed(2)}%` : `${p.deviation.toFixed(2)}%`;
      console.log(`  Participant ${p.id.toString().padStart(3)}:  ${p.wins.toString().padStart(5)} wins  (${p.percentage.toFixed(2)}%)  ${deviationStr.padStart(8)}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STATISTICAL ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Expected wins per participant: ${expectedWins.toFixed(2)} (${expectedPercentage.toFixed(2)}%)`);

  const minWins = Math.min(...winCounts);
  const maxWins = Math.max(...winCounts);
  const range = maxWins - minWins;

  console.log(`Minimum wins: ${minWins}`);
  console.log(`Maximum wins: ${maxWins}`);
  console.log(`Range: ${range}`);

  // Calculate standard deviation
  const mean = expectedWins;
  const squaredDiffs = winCounts.map(count => Math.pow(count - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / winCounts.length;
  const stdDev = Math.sqrt(variance);

  console.log(`Standard deviation: ${stdDev.toFixed(2)}`);

  // Chi-squared test for uniformity
  const chiSquared = winCounts.reduce((sum, count) => {
    return sum + Math.pow(count - expectedWins, 2) / expectedWins;
  }, 0);

  console.log(`Chi-squared statistic: ${chiSquared.toFixed(2)}`);

  const degreesOfFreedom = participants.length - 1;
  console.log(`Degrees of freedom: ${degreesOfFreedom}`);

  // Critical values for chi-squared at 95% confidence for common df values
  // For large df, approximate: critical value ≈ df + 2*sqrt(df)
  const criticalValues = {
    9: 16.92,   // 10 participants
    10: 18.31,  // 11 participants
    99: 123.23, // 100 participants
    249: 287.88, // 250 participants
    499: 552.07  // 500 participants
  };

  const criticalValue = criticalValues[degreesOfFreedom] ||
    (degreesOfFreedom + 2 * Math.sqrt(degreesOfFreedom)); // approximation for other values

  const isUniform = chiSquared < criticalValue;

  console.log(`\n${isUniform ? '✅' : '❌'} Distribution is ${isUniform ? 'UNIFORM' : 'NOT UNIFORM'} (95% confidence)`);
  console.log(`   (Chi-squared ${chiSquared.toFixed(2)} ${isUniform ? '<' : '>'} critical value ${criticalValue.toFixed(2)})`);

}

/**
 * Main test runner
 */
function runAllTests() {
  console.log('\n🎲 RANDOMNESS TEST FOR 50/50 DRAW');
  console.log('═'.repeat(70));
  console.log('Testing with multiple participant sizes and draw counts');
  console.log('═'.repeat(70));

  // Test different participant pool sizes
  const participantSizes = [10, 11, 100, 250, 500];
  const sampleSizes = [100, 500, 10000];

  participantSizes.forEach(participantCount => {
    console.log(`\n\n${'█'.repeat(70)}`);
    console.log(`  PARTICIPANT POOL SIZE: ${participantCount}`);
    console.log('█'.repeat(70));

    const participants = Array.from({ length: participantCount }, (_, i) => ({
      id: i + 1,
      name: `Participant ${i + 1}`
    }));

    sampleSizes.forEach(sampleSize => {
      runTestForSampleSize(participants, sampleSize);
    });
  });

  // Additional analysis for the 12-draw scenario (only for 11 participants)
  console.log(`\n\n${'█'.repeat(70)}`);
  console.log('  SMALL SAMPLE ANALYSIS (Your observed 12 draws with 11 participants)');
  console.log('█'.repeat(70) + '\n');

  const participants = Array.from({ length: 11 }, (_, i) => ({
    id: i + 1,
    name: `Participant ${i + 1}`
  }));

  console.log('With only 12 draws, seeing 3/12 and 2/12 for specific participants');
  console.log('is well within normal variance. Let\'s simulate this:\n');

  // Run 1000 sets of 12 draws to see how often we get clustering
  let setsWithThreeOrMore = 0;

  for (let set = 0; set < 1000; set++) {
    const smallWinCounts = new Array(participants.length).fill(0);
    for (let draw = 0; draw < 12; draw++) {
      const winner = conductSimulatedDraw(participants);
      smallWinCounts[winner.id - 1]++;
    }
    if (Math.max(...smallWinCounts) >= 3) {
      setsWithThreeOrMore++;
    }
  }

  const percentageWithClustering = (setsWithThreeOrMore / 1000) * 100;

  console.log(`Out of 1000 simulated sets of 12 draws:`);
  console.log(`${setsWithThreeOrMore} sets (${percentageWithClustering.toFixed(1)}%) had at least one participant win 3+ times`);
  console.log(`\n💡 Your observation is ${percentageWithClustering > 20 ? 'completely normal' : 'unusual but possible'} for such a small sample.`);

  console.log('\n' + '═'.repeat(70) + '\n');
}

// Run all tests
runAllTests();
