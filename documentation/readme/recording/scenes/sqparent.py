pg.wait_for_timeout(1200)
pg.get_by_text('Fix checkout rounding').first.click(); pg.wait_for_timeout(3000)
