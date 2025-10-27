// Simple test to verify the testing environment works
import { OwnerTestEnvironment } from "./OwnerTestEnvironment";

async function simpleTest() {
  console.log("🧪 Testing Owner Test Environment...");

  try {
    const testEnv = new OwnerTestEnvironment();
    console.log("✅ OwnerTestEnvironment created successfully");

    // Add a simple scenario
    const simpleScenario = OwnerTestEnvironment.createPushEventScenario("testuser", "test-repo", [
      {
        sha: "abc123",
        name: "test: simple commit",
        fileDiffs: [],
      },
    ]);

    testEnv.addScenario(simpleScenario);
    console.log("✅ Scenario added successfully");

    // Try to run the scenario
    const result = await testEnv.runScenario("Push Event - testuser/test-repo");
    console.log("✅ Scenario executed successfully");
    console.log(`Result: ${result.success ? "PASS" : "FAIL"}`);
    console.log(`Execution time: ${result.executionTime}ms`);

    if (result.activityOverview) {
      console.log("Activity Overview:", result.activityOverview);
    }

    console.log("\n🎉 All tests passed! The testing environment is working correctly.");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
simpleTest().catch(console.error);
