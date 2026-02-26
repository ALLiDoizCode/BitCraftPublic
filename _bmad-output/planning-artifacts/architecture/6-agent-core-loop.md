# 6. Agent Core Loop

```typescript
class BitCraftAgent {
  private gameClient: SpacetimeDBClient;    // Direct subscription (free reads)
  private actionClient: CrosstownClient;     // Nostr → BLS → reducer (paid writes)
  private plugins: CognitionStack;
  private logger: DecisionLogger;
  private config: AgentConfig;

  async run(): Promise<void> {
    // Initialize game connection
    await this.gameClient.connect(this.config.spacetimeUrl);
    await this.actionClient.start();

    // Load static data (Layer 1)
    const encyclopedia = await this.plugins.staticData.process();

    // Subscribe to game state updates
    this.gameClient.subscribe([
      "SELECT * FROM player_state WHERE player_id = ?",
      "SELECT * FROM entity WHERE distance(pos, ?) < 100",
      // ... configured subscriptions
    ]);

    // Main loop
    while (this.config.running) {
      // 1. PERCEIVE — collect raw updates since last tick
      const rawUpdates = this.gameClient.drainUpdates();

      // 2. INTERPRET — raw data → semantic events (Layer 2)
      const events = await this.plugins.interpreter.process(rawUpdates, this.context);

      // 3. REMEMBER — store important events, recall relevant memories (Layer 3)
      for (const event of events.filter(e => e.importance >= 5)) {
        await this.plugins.memory.record(event);
      }
      const memories = await this.plugins.memory.recall(this.context);

      // 4. DETECT — what can I do here? (Layer 4)
      const affordances = await this.plugins.affordances.process(
        this.gameClient.currentState, this.context
      );

      // 5. DECIDE — choose action based on goals + memories + affordances (Layer 5)
      const decision = await this.plugins.planner.process({
        affordances,
        memories,
        goals: this.config.goals,
        budget: this.getBudgetState(),
      }, this.context);

      // 6. ACT — execute via Crosstown payment
      const result = await this.executeAction(decision);

      // 7. LOG — record everything for research
      await this.logger.logTick({
        tick: this.tickCount,
        timestamp: Date.now(),
        rawUpdates: rawUpdates.length,
        events,
        memoriesRecalled: memories.length,
        affordancesDetected: affordances.length,
        decision,
        result,
        budgetRemaining: this.getBudgetState().remaining,
      });

      // 8. LEARN — record outcome for future recall
      await this.plugins.memory.record(
        { ...decision.affordance, outcome: result } as SemanticEvent
      );

      await this.sleep(this.config.tickInterval);
    }
  }

  private async executeAction(decision: PlannedAction): Promise<ActionResult> {
    const event = this.buildGameActionEvent(decision.affordance);
    const result = await this.actionClient.publishEvent(event);
    return {
      success: result.success,
      fulfillment: result.fulfillment,
      error: result.error,
      cost: decision.affordance.cost,
    };
  }

  private buildGameActionEvent(affordance: Affordance): NostrEvent {
    return finalizeEvent({
      kind: 30078,
      content: JSON.stringify({
        reducer: affordance.reducer,
        args: affordance.args,
      }),
      tags: [
        ['d', 'bitcraft-action'],
        ['game', 'bitcraft'],
        ['reducer', affordance.reducer],
        ['cost', String(affordance.cost)],
      ],
      created_at: Math.floor(Date.now() / 1000),
    }, this.config.secretKey);
  }
}
```

---
