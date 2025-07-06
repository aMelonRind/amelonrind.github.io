(module ;; this module is a manual impl of how [[4, 1, 2], [3, 1, 3], [2, 1, 2]] looks like
  (memory 1)
  (export "memory" (memory 0))
  (; memory locations (for test, not compact)
    arr type: (placement, count ptr)[]
    *these are js initialized, and they makes sure that they have valid lengths.
    item a arr 0: 0000*
    item b arr 0: 1000*
    item c arr 0: 2000*
    item a arr 1: 3000
    item b arr 1: 4000
    item c arr 1: 5000
    item a count: 6000
    item b arr 2: 7000
    item c arr 2: 8000
    item b arr 3: 9000
    item c arr 3: 10000
    item b arr 4: 11000
    item c arr 4: 12000
    item b count: 13000
    item c arr 5: 14000
    item c arr 6: 15000
    item c count: 16000
  ;)
  (func (export "main") (param $board i64) (result i64)
    (local $idx i32)
    (local $ptr i32)
    (local $total i64)
    (local $count1 i64)(local $count2 i64)(local $count3 i64)(local $count4 i64)(local $count5 i64)(local $count6 i64)
    (local $board1 i64)(local $board2 i64)(local $board3 i64)(local $board4 i64)(local $board5 i32)(local $board6 i32)
    (local $tmp64 i64)

    (local $aend1 i32)
    (local $bend1 i32)(local $bend2 i32)(local $bend3 i32)(local $bend4 i32)
    (local $cend1 i32)(local $cend2 i32)(local $cend3 i32)(local $cend4 i32)(local $cend5 i32)(local $cend6 i32)

    (local $idx0 i32)(local $idx1 i32)(local $idx2 i32)(local $idx3 i32)(local $idx4 i32)(local $idx5 i32);;(local $idx6 i32)
    (local $ptr0 i32)(local $ptr1 i32)(local $ptr2 i32)(local $ptr3 i32);;(local $ptr4 i32)(local $ptr5 i32)(local $ptr6 i32)

    ;; 4x1: 48 * 12 = 576
    ;; 3x1: 62 * 12 = 744
    ;; 2x1: 76 * 12 = 912
    ;; load idx max
    i64.const 0
    local.set $total
    i32.const 3000
    local.set $aend1
    i32.const 576 ;; static aend0
    local.set $idx0
    loop
      ;; decrement idx
      local.get $idx0
      i32.const 12
      i32.sub
      local.tee $idx0
      ;; verify placement
      i64.load
      local.get $board
      i64.and
      i64.eqz
      if
        ;; place item on board
        local.get $board
        local.get $idx0
        i64.load
        i64.or
        local.set $board1
        ;; move placement
        local.get $aend1
        local.get $idx0
        i64.load
        i64.store
        ;; move ptr
        local.get $aend1
        local.get $idx0
        i32.load offset=8
        local.tee $ptr0
        i32.store offset=8
        ;; condition to inner
        local.get $aend1
        i32.const 3000
        i32.gt_u
        if
          ;; filter other two
          i32.const 4000
          local.set $bend1
          i32.const 1744
          local.set $idx
          loop
            ;; decrement idx
            local.get $idx
            i32.const 12
            i32.sub
            local.tee $idx
            ;; verify placement
            i64.load
            local.get $board1
            i64.and
            i64.eqz
            if
              ;; move placement
              local.get $bend1
              local.get $idx
              i64.load
              i64.store
              ;; move ptr
              local.get $bend1
              local.get $idx
              i32.load offset=8
              i32.store offset=8
              ;; increment arr end
              local.get $bend1
              i32.const 12
              i32.add
              local.set $bend1
            end
            local.get $idx
            i32.const 1000
            i32.gt_u
            br_if 0
          end
          i32.const 5000
          local.set $cend1
          i32.const 2912
          local.set $idx
          loop
            ;; decrement idx
            local.get $idx
            i32.const 12
            i32.sub
            local.tee $idx
            ;; verify placement
            i64.load
            local.get $board1
            i64.and
            i64.eqz
            if
              ;; move placement
              local.get $cend1
              local.get $idx
              i64.load
              i64.store
              ;; move ptr
              local.get $cend1
              local.get $idx
              i32.load offset=8
              i32.store offset=8
              ;; increment arr end
              local.get $cend1
              i32.const 12
              i32.add
              local.set $cend1
            end
            local.get $idx
            i32.const 2000
            i32.gt_u
            br_if 0
          end
          ;; load idx max
          i64.const 0
          local.set $count1
          local.get $aend1
          local.set $idx1
          ;;; inner loop here
          loop
            ;; decrement idx
            local.get $idx1
            i32.const 12
            i32.sub
            local.tee $idx1
            ;; verify placement
            i64.load
            local.get $board1
            i64.and
            i64.eqz
            if
              ;; place item on board
              local.get $board1
              local.get $idx1
              i64.load
              i64.or
              local.set $board2
              ;; ;; filter b
              ;; i32.const 7000
              ;; local.set $bend2
              ;; local.get $bend1
              ;; local.set $idx
              ;; loop
              ;;   ;; decrement idx
              ;;   local.get $idx
              ;;   i32.const 12
              ;;   i32.sub
              ;;   local.tee $idx
              ;;   ;; verify placement
              ;;   i64.load
              ;;   local.get $board2
              ;;   i64.and
              ;;   i64.eqz
              ;;   if
              ;;     ;; move placement
              ;;     local.get $bend2
              ;;     local.get $idx
              ;;     i64.load
              ;;     i64.store
              ;;     ;; move ptr
              ;;     local.get $bend2
              ;;     local.get $idx
              ;;     i32.load offset=8
              ;;     i32.store offset=8
              ;;     ;; increment arr end
              ;;     local.get $bend2
              ;;     i32.const 12
              ;;     i32.add
              ;;     local.set $bend2
              ;;   end
              ;;   local.get $idx
              ;;   i32.const 4000
              ;;   i32.gt_u
              ;;   br_if 0
              ;; end
              ;; condition to inner
              local.get $bend1
              i32.const 4000
              i32.gt_u
              if
                ;; filter c
                i32.const 8000
                local.set $cend2
                local.get $cend1
                local.set $idx
                loop
                  ;; decrement idx
                  local.get $idx
                  i32.const 12
                  i32.sub
                  local.tee $idx
                  ;; verify placement
                  i64.load
                  local.get $board2
                  i64.and
                  i64.eqz
                  if
                    ;; move placement
                    local.get $cend2
                    local.get $idx
                    i64.load
                    i64.store
                    ;; move ptr
                    local.get $cend2
                    local.get $idx
                    i32.load offset=8
                    i32.store offset=8
                    ;; increment arr end
                    local.get $cend2
                    i32.const 12
                    i32.add
                    local.set $cend2
                  end
                  local.get $idx
                  i32.const 5000
                  i32.gt_u
                  br_if 0
                end
                ;; load idx max
                i64.const 0
                local.set $count2
                i32.const 9000
                local.set $bend3
                local.get $bend1
                local.set $idx2
                ;;; inner loop here
                loop
                  ;; decrement idx
                  local.get $idx2
                  i32.const 12
                  i32.sub
                  local.tee $idx2
                  ;; verify placement
                  i64.load
                  local.get $board2
                  i64.and
                  i64.eqz
                  if
                    ;; place item on board
                    local.get $board2
                    local.get $idx2
                    i64.load
                    i64.or
                    local.set $board3
                    ;; move placement
                    local.get $bend3
                    local.get $idx2
                    i64.load
                    i64.store
                    ;; move ptr
                    local.get $bend3
                    local.get $idx2
                    i32.load offset=8
                    local.tee $ptr1
                    i32.store offset=8
                    ;; condition to inner
                    local.get $bend3
                    i32.const 9000
                    i32.gt_u
                    if
                      ;; filter c
                      i32.const 10000
                      local.set $cend3
                      local.get $cend2
                      local.set $idx
                      loop
                        ;; decrement idx
                        local.get $idx
                        i32.const 12
                        i32.sub
                        local.tee $idx
                        ;; verify placement
                        i64.load
                        local.get $board3
                        i64.and
                        i64.eqz
                        if
                          ;; move placement
                          local.get $cend3
                          local.get $idx
                          i64.load
                          i64.store
                          ;; move ptr
                          local.get $cend3
                          local.get $idx
                          i32.load offset=8
                          i32.store offset=8
                          ;; increment arr end
                          local.get $cend3
                          i32.const 12
                          i32.add
                          local.set $cend3
                        end
                        local.get $idx
                        i32.const 8000
                        i32.gt_u
                        br_if 0
                      end
                      ;; load idx max
                      i64.const 0
                      local.set $count3
                      i32.const 11000
                      local.set $bend4
                      local.get $bend3
                      local.set $idx3
                      ;;; inner loop here
                      loop
                        ;; decrement idx
                        local.get $idx3
                        i32.const 12
                        i32.sub
                        local.tee $idx3
                        ;; verify placement
                        i64.load
                        local.get $board3
                        i64.and
                        i64.eqz
                        if
                          ;; place item on board
                          local.get $board3
                          local.get $idx3
                          i64.load
                          i64.or
                          local.set $board4
                          ;; move placement
                          local.get $bend4
                          local.get $idx3
                          i64.load
                          i64.store
                          ;; move ptr
                          local.get $bend4
                          local.get $idx3
                          i32.load offset=8
                          local.tee $ptr2
                          i32.store offset=8
                          ;; condition to inner
                          local.get $bend4
                          i32.const 11000
                          i32.gt_u
                          if
                            ;; filter c, transform to 32bits
                            i32.const 12000
                            local.set $cend4
                            local.get $cend3
                            local.set $idx
                            loop
                              ;; decrement idx
                              local.get $idx
                              i32.const 12
                              i32.sub
                              local.tee $idx
                              ;; verify placement
                              i64.load
                              local.get $board4
                              i64.and
                              i64.eqz
                              if
                                ;; move placement
                                local.get $cend4
                                local.get $idx
                                i64.load
                                local.tee $tmp64
                                ;; convert32
                                i64.const 1
                                i64.shl
                                local.get $tmp64
                                i64.and
                                i64.eqz
                                if (result i64) ;; verticle
                                  i64.const 2
                                  i64.const 0x1FE ;; 0b1_1111_1110
                                  local.get $tmp64
                                  i64.ctz
                                  local.tee $count6 ;; borrow variable for trailing zeroes
                                  i64.shl
                                  local.get $board4
                                  i64.or
                                  local.get $board4
                                  i64.xor
                                  i64.popcnt
                                  i64.shl
                                  i64.const 1
                                  i64.or
                                  i64.const 1
                                  local.get $count6
                                  i64.shl
                                  i64.const 1
                                  i64.sub
                                  local.get $board4
                                  i64.or
                                  local.get $board4
                                  i64.xor
                                  i64.popcnt
                                  i64.shl
                                else ;; horizontal
                                  i64.const 3 ;; 0b11
                                  i64.const 1
                                  local.get $tmp64
                                  i64.ctz
                                  i64.shl
                                  i64.const 1
                                  i64.sub
                                  local.get $board4
                                  i64.or
                                  local.get $board4
                                  i64.xor
                                  i64.popcnt
                                  i64.shl
                                end
                                i32.wrap_i64
                                i32.store
                                ;; move ptr
                                local.get $cend4
                                local.get $idx
                                i32.load offset=8
                                i32.store offset=4
                                ;; increment arr end
                                local.get $cend4
                                i32.const 8
                                i32.add
                                local.set $cend4
                              end
                              local.get $idx
                              i32.const 10000
                              i32.gt_u
                              br_if 0
                            end
                            ;; load idx max
                            i64.const 0
                            local.set $count4
                            local.get $bend4
                            local.set $idx4
                            ;;; inner loop here
                            loop
                              ;; decrement idx
                              local.get $idx4
                              i32.const 12
                              i32.sub
                              local.tee $idx4
                              ;; verify placement
                              i64.load
                              local.get $board4
                              i64.and
                              i64.eqz
                              if
                                ;; ;; place item on board
                                ;; local.get $board4
                                ;; local.get $idx4
                                ;; i64.load
                                ;; i64.or
                                ;; local.set $board5
                                local.get $idx4
                                i64.load
                                local.tee $tmp64
                                ;; convert32
                                i64.const 1
                                i64.shl
                                local.get $tmp64
                                i64.and
                                i64.eqz
                                if (result i64) ;; verticle
                                  i64.const 4
                                  i64.const 0x3FC00 ;; 0b11_1111_110 0_0000_0000
                                  local.get $tmp64
                                  i64.ctz
                                  local.tee $count6 ;; borrow variable for trailing zeroes
                                  i64.shl
                                  local.get $board4
                                  i64.or
                                  local.get $board4
                                  i64.xor
                                  i64.popcnt
                                  i64.shl
                                  i64.const 2
                                  i64.or
                                  ;;
                                  i64.const 0x1FE ;; 0b1_1111_1110
                                  local.get $count6
                                  i64.shl
                                  local.get $board4
                                  i64.or
                                  local.get $board4
                                  i64.xor
                                  i64.popcnt
                                  i64.shl
                                  i64.const 1
                                  i64.or
                                  i64.const 1
                                  local.get $count6
                                  i64.shl
                                  i64.const 1
                                  i64.sub
                                  local.get $board4
                                  i64.or
                                  local.get $board4
                                  i64.xor
                                  i64.popcnt
                                  i64.shl
                                else ;; horizontal
                                  i64.const 7 ;; 0b111
                                  i64.const 1
                                  local.get $tmp64
                                  i64.ctz
                                  i64.shl
                                  i64.const 1
                                  i64.sub
                                  local.get $board4
                                  i64.or
                                  local.get $board4
                                  i64.xor
                                  i64.popcnt
                                  i64.shl
                                end
                                i32.wrap_i64
                                local.set $board5
                                ;; ;; no filter c
                                ;; condition to inner
                                local.get $cend4
                                i32.const 12000
                                i32.gt_u
                                if
                                  ;; load idx max
                                  i64.const 0
                                  local.set $count5
                                  i32.const 15000
                                  local.set $cend6
                                  local.get $cend4
                                  local.set $idx5
                                  ;;; inner loop here
                                  loop
                                    ;; decrement idx
                                    local.get $idx5
                                    i32.const 8
                                    i32.sub
                                    local.tee $idx5
                                    ;; verify placement
                                    i32.load
                                    local.get $board5
                                    i32.and
                                    i32.eqz
                                    if
                                      ;; place item on board
                                      local.get $idx5
                                      i32.load
                                      local.set $board6
                                      ;; move placement & ptr
                                      local.get $cend6
                                      local.get $idx5
                                      i64.load
                                      i64.store
                                      ;; move ptr
                                      ;; local.get $cend6
                                      ;; local.get $idx5
                                      ;; i32.load offset=8
                                      ;; local.tee $ptr3
                                      ;; i32.store offset=8
                                      ;; condition to inner
                                      local.get $cend6
                                      i32.const 15000
                                      i32.gt_u
                                      if
                                        block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32)
                                        block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32)
                                        block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32)
                                        block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32)
                                        block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32)
                                        block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32)
                                        block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32)
                                        block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32) block (result i32)
                                          i32.const 0
                                          local.get $cend6
                                          i32.const 15000
                                          i32.sub
                                          i32.const 3
                                          i32.shr_u
                                          br_table 63 62 61 60 59 58 57 56 55 54 53 52 51 50 49 48 47 46 45 44 43 42 41 40 39 38 37 36 35 34 33 32 31 30 29 28 27 26 25 24 23 22 21 20 19 18 17 16 15 14 13 12 11 10 9 8 7 6 5 4 3 2 1 0
                                        end
                                          (i32.and (i32.load (i32.const 15496)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15500)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15488)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15492)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15480)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15484)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15472)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15476)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15464)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15468)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15456)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15460)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15448)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15452)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15440)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15444)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15432)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15436)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15424)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15428)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15416)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15420)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15408)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15412)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15400)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15404)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15392)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15396)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15384)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15388)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15376)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15380)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15368)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15372)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15360)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15364)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15352)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15356)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15344)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15348)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15336)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15340)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15328)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15332)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15320)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15324)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15312)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15316)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15304)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15308)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15296)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15300)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15288)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15292)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15280)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15284)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15272)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15276)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15264)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15268)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15256)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15260)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15248)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15252)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15240)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15244)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15232)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15236)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15224)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15228)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15216)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15220)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15208)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15212)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15200)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15204)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15192)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15196)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15184)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15188)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15176)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15180)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15168)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15172)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15160)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15164)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15152)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15156)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15144)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15148)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15136)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15140)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15128)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15132)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15120)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15124)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15112)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15116)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15104)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15108)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15096)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15100)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15088)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15092)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15080)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15084)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15072)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15076)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15064)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15068)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15056)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15060)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15048)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15052)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15040)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15044)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15032)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15036)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15024)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15028)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15016)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15020)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          (i32.and (i32.load (i32.const 15008)) (local.get $board6))
                                          br_if 0
                                          (i64.store (i32.load (i32.const 15012)) (i64.add (i64.load (local.get $ptr (local.tee $ptr))) (i64.const 1)))
                                          (i32.add (i32.const 1))
                                        end
                                          i32.const 15000
                                          i32.load
                                          local.get $board6
                                          i32.and
                                          br_if 0
                                          i32.const 15004
                                          i32.load
                                          local.tee $ptr
                                          local.get $ptr
                                          i64.load
                                          i64.const 1
                                          i64.add
                                          i64.store

                                          i32.const 1
                                          i32.add
                                        end
                                        i64.extend_i32_u
                                        local.tee $count6
                                        ;; add to previous
                                        local.get $count5
                                        i64.add
                                        local.set $count5
                                        ;; add count to the memory
                                        local.get $idx5
                                        i32.load offset=4
                                        local.tee $ptr
                                        local.get $ptr
                                        i64.load
                                        local.get $count6
                                        i64.add
                                        i64.store
                                      end
                                      ;; increment arr end
                                      local.get $cend6
                                      i32.const 8
                                      i32.add
                                      local.set $cend6
                                    end
                                    local.get $idx5
                                    i32.const 12000
                                    i32.gt_u
                                    br_if 0
                                  end
                                  ;;;
                                  local.get $count5
                                  ;; add to previous
                                  local.get $count4
                                  i64.add
                                  local.set $count4
                                  ;; add count to the memory
                                  local.get $idx4
                                  i32.load offset=8
                                  local.tee $ptr
                                  local.get $ptr
                                  i64.load
                                  local.get $count5
                                  i64.add
                                  i64.store
                                end
                              end
                              local.get $idx4
                              i32.const 11000
                              i32.gt_u
                              br_if 0
                            end
                            ;;;
                            local.get $count4
                            ;; add to previous
                            local.get $count3
                            i64.add
                            local.set $count3
                            ;; add count to the memory
                            local.get $ptr2
                            local.get $ptr2
                            i64.load
                            local.get $count4
                            i64.add
                            i64.store
                          end
                          ;; increment arr end
                          local.get $bend4
                          i32.const 12
                          i32.add
                          local.set $bend4
                        end
                        local.get $idx3
                        i32.const 9000
                        i32.gt_u
                        br_if 0
                      end
                      ;;;
                      local.get $count3
                      ;; add to previous
                      local.get $count2
                      i64.add
                      local.set $count2
                      ;; add count to the memory
                      local.get $ptr1
                      local.get $ptr1
                      i64.load
                      local.get $count3
                      i64.add
                      i64.store
                    end
                    ;; increment arr end
                    local.get $bend3
                    i32.const 12
                    i32.add
                    local.set $bend3
                  end
                  local.get $idx2
                  i32.const 4000
                  i32.gt_u
                  br_if 0
                end
                ;;;
                local.get $count2
                ;; add to previous
                local.get $count1
                i64.add
                local.set $count1
                ;; add count to the memory
                local.get $idx1
                i32.load offset=8
                local.tee $ptr
                local.get $ptr
                i64.load
                local.get $count2
                i64.add
                i64.store
              end
            end
            local.get $idx1
            i32.const 3000
            i32.gt_u
            br_if 0
          end
          ;;;
          local.get $count1
          ;; add to previous
          local.get $total
          i64.add
          local.set $total
          ;; add count to the memory
          local.get $ptr0
          local.get $ptr0
          i64.load
          local.get $count1
          i64.add
          i64.store
        end
        ;; increment arr end
        local.get $aend1
        i32.const 12
        i32.add
        local.set $aend1
      end
      local.get $idx0
      ;; i32.const 0
      ;; i32.gt_u
      br_if 0
    end
    local.get $total
  )
)