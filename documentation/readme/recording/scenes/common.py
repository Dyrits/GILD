exec(open("/tmp/iskios-demo/scripts/nav.py").read())
def bottom(): pg.mouse.move(600, 420); pg.mouse.wheel(0, 4000); pg.wait_for_timeout(300); pg.mouse.move(1275, 795); pg.wait_for_timeout(200)
def hide_panel():
    if pg.get_by_label('Hide quest panel').count() > 0: pg.get_by_label('Hide quest panel').first.click(); pg.wait_for_timeout(600)
