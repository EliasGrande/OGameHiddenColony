
DIR_DIST = ./dist
DIR_VERSIONS = $(DIR_DIST)/versions
DIR_SRC  = ./src
DIR_UTIL = ./util

MAKEFILE   = ./Makefile
GETMETA    = $(DIR_UTIL)/getmeta
GETMETAVAR = $(DIR_UTIL)/getmetavar
MKNAME     = $(DIR_UTIL)/mkname
MKUPDATE   = $(DIR_UTIL)/mkupdate
COMPRESS   = $(DIR_UTIL)/compress

SRC     = $(DIR_SRC)/main-dev.user.js
SRC_URL = file://`pwd`/$(SRC)

SRCS = $(MAKEFILE) $(GETMETA) $(GETMETAVAR) $(MKNAME) $(COMPRESS) $(SRC)

OUT         = $(DIR_VERSIONS)/`$(MKNAME) $(SRC)`
LATEST_USER = $(DIR_DIST)/latest.user.js
LATEST_META = $(DIR_DIST)/latest.meta.js
LATEST      = $(LATEST_USER) $(LATEST_META)
LATEST_URL  = file://`pwd`/$(LATEST_USER)
UPDATER     = $(DIR_DIST)/updater.js

CH_WIN   = sh -c "ps | grep -qi \$$1 && wmctrl -a \$$1; exit 0" +o
GEDIT    = $(CH_WIN) gedit; gedit
ECLIPSE  = $(CH_WIN) eclipse; eclipse
TEST_NAV = $(CH_WIN) firefox; firefox
NO_OUT   = > /dev/null 2> /dev/null

$(LATEST): $(SRC)
	mkdir -p $(DIR_VERSIONS)
	$(GETMETA) $(SRC) > $(LATEST_META)
	$(COMPRESS) $(SRC) > $(LATEST_USER)
	cp $(LATEST_USER) $(OUT)

updater:
	$(MKUPDATE) $(SRC) > $(UPDATER)

commit:
	sh -c "git commit -a; exit 0"

push: commit
	git push
	
test:
	$(TEST_NAV) $(SRC_URL) $(NO_OUT) &
	
install: $(LATEST)
	$(TEST_NAV) $(LATEST_URL) $(NO_OUT) &

gedit:
	$(GEDIT) $(SRC) $(NO_OUT) &

gedit-all:
	$(GEDIT) $(SRCS) $(NO_OUT) &

eclipse:
	$(ECLIPSE) $(SRC) $(NO_OUT) &

eclipse-all:
	$(ECLIPSE) $(SRCS) $(NO_OUT) &

default: $(LATEST)

