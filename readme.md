# Two bigger than one

Rules:

- board size is 5x5, and when you place the tank, you must set a direction among 8, and it is unchangeable
- when two tanks (in same group) pointing towards the same enemy without any obstacle, this enemy will be removed from the board
- every player takes turns to player, till one of it cannot find a safe place to place a new tank
- when player place a new tank, it must ensure that it won't be killed immediately. For example, when two enemies are pointing towards this block, the player cannot place tank here
- when game end, we count the score. It depends on:
  - the enemy tank you have killed
  - yours tanks remaining on the board
  - the blocks that you controlled
- controlled block means that at least two tanks are pointing towards it without any obstacle
