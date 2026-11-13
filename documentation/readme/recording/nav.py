def go(title):
    pg.wait_for_timeout(800)
    pg.get_by_text(title).first.click(); pg.wait_for_timeout(1200)
